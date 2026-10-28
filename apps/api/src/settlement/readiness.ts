import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import { connect } from "../db/client.js";
import { BlobCheckpoints } from "../audit/blob.js";
import type { PoolClient } from "pg";
import { auditStore, canonical, digest } from "../audit/store.js";
import { incidentPins } from "../audit/incident-pins.js";

// Operator-controlled check during maintenance. No financial mutation or
// checkpoint publication; the sole optional write is a fixed isolated probe.
export async function rotationReadiness(): Promise<Response> {
  if (process.env.FINANCIAL_MAINTENANCE !== "true")
    return new Response("Not found", { status: 404 });
  let stage = "configuration";
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  const cutoff = process.env.ROTATION_SESSION_CUTOFF;
  if (!url || !cutoff || !Number.isFinite(Date.parse(cutoff)))
    return Response.json({ ok: false, stage }, { status: 503 });
  const { pool } = connect(url);
  let client: PoolClient | undefined;
  try {
    stage = "database";
    client = await pool.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const {
      rows: [stats],
    } = await client.query<{
      bad_reserves: string;
      bad_settlements: string;
      pending: string;
      settled: string;
      old_connections: string;
      migrations: string;
    }>(
      `SELECT
      (SELECT count(*) FROM wallets w WHERE w.committed_cents <> COALESCE((SELECT sum(a.current_cents) FROM auctions a WHERE a.leader_id=w.user_id AND a.settled_at IS NULL AND a.cancelled_at IS NULL),0))::text AS bad_reserves,
      (SELECT count(*) FROM auctions a WHERE a.settled_at IS NOT NULL AND (
        (a.leader_id IS NULL AND (EXISTS(SELECT 1 FROM receipts r WHERE r.auction_id=a.id) OR EXISTS(SELECT 1 FROM wallet_entries e WHERE e.auction_id=a.id))) OR
        (a.leader_id IS NOT NULL AND (
          (SELECT count(*) FROM receipts r WHERE r.auction_id=a.id AND r.winner_id=a.leader_id AND r.amount_cents=a.current_cents AND r.settled_at=a.settled_at AND r.ended_at=a.ends_at)<>1 OR
          (SELECT count(*) FROM wallet_entries e WHERE e.auction_id=a.id)<>2 OR
          (SELECT count(*) FROM wallet_entries e WHERE e.auction_id=a.id AND e.kind='PURCHASE' AND e.user_id=a.leader_id AND e.amount_cents=-a.current_cents)<>1 OR
          (SELECT count(*) FROM wallet_entries e WHERE e.auction_id=a.id AND e.kind='SALE' AND e.user_id=a.owner_id AND e.amount_cents=a.current_cents)<>1
        ))))::text AS bad_settlements,
      (SELECT count(*) FROM auctions WHERE settled_at IS NULL AND cancelled_at IS NULL AND ends_at<=clock_timestamp())::text AS pending,
      (SELECT count(*) FROM auctions WHERE settled_at IS NOT NULL)::text AS settled,
      (SELECT count(*) FROM pg_stat_activity WHERE usename=current_user AND pid<>pg_backend_pid() AND backend_start<$1::timestamptz)::text AS old_connections,
      (SELECT count(*) FROM schema_migrations)::text AS migrations`,
      [cutoff],
    );
    if (!stats) throw new Error("No verification result");
    stage = "financial-invariants";
    if (
      Number(stats.bad_reserves) !== 0 ||
      Number(stats.bad_settlements) !== 0 ||
      Number(stats.old_connections) !== 0
    )
      throw new Error(
        "Inconsistent financial state or pre-rotation connections",
      );
    // Comparison only; no rows/balances are returned. This is the incident's
    // observed baseline, not a prohibition on legitimate future operations.
    const observed: Record<string, unknown> = {};
    for (const [table, order] of Object.entries({
      wallets: "user_id",
      wallet_entries: "id",
      auctions: "id",
      bids: "id",
      receipts: "id",
      audit_records: "auction_id,sequence",
    }))
      observed[table] = (
        await client.query(
          `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY ${order}),'[]'::jsonb) AS rows FROM ${table} t`,
        )
      ).rows[0]!.rows;
    const financialSnapshotMatchesIncidentBaseline =
      digest(observed) === incidentPins.knownFinancialSnapshotHash;
    stage = "signing-identity";
    const pem = process.env.AUDIT_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!pem) throw new Error("Missing key");
    const publicKey = createPublicKey(createPrivateKey(pem))
      .export({ type: "spki", format: "pem" })
      .toString();
    const fingerprint = createHash("sha256").update(publicKey).digest("hex");
    if (fingerprint !== process.env.AUDIT_PUBLIC_KEY_FINGERPRINT)
      throw new Error("Pin mismatch");
    const token = process.env.BLOB_READ_WRITE_TOKEN ?? "";
    const store = new BlobCheckpoints(
      token,
      process.env.AUDIT_BLOB_PREFIX ?? "elite-v1/",
    );
    stage = "blob-read";
    // Rotation retains public.pem as the historical root; the active identity
    // and transition are independently pinned and checked by AuditStore.
    const identity = process.env.AUDIT_TRANSITION_JSON
      ? await auditStore()
      : undefined;
    if (
      (await store.read("public.pem")) !==
      (identity?.transition?.legacyPublicKey ?? publicKey)
    )
      throw new Error("Remote pin mismatch");
    const probeId = process.env.ROTATION_PROBE_ID;
    let probeWritten = false;
    let signingProof:
      | { payload: Record<string, unknown>; hash: string; signature: string }
      | undefined;
    let existingSigningProofVerified = false;
    if (identity?.transition) {
      stage = "signing-proof";
      const payload = {
        scope: "elite-audit-key-readiness",
        version: 1,
        activeFingerprint: fingerprint,
        transitionHash: process.env.AUDIT_TRANSITION_SHA256!,
      };
      const hash = digest(payload),
        signature = sign(
          null,
          Buffer.from(hash, "hex"),
          createPrivateKey(pem),
        ).toString("base64");
      if (
        !verify(
          null,
          Buffer.from(hash, "hex"),
          publicKey,
          Buffer.from(signature, "base64"),
        )
      )
        throw new Error("Signing proof failed");
      signingProof = { payload, hash, signature };
      const proofs = new BlobCheckpoints(token, "rotation-probes/");
      const path = `key-${fingerprint}-${payload.transitionHash}.json`,
        body = canonical(signingProof);
      const existing = await proofs.read(path);
      if (
        process.env.AUDIT_REQUIRE_EXISTING_SIGNING_PROOF === "true" &&
        existing !== body
      )
        throw new Error(
          "Persistent signing proof missing or changed; refusing recreation",
        );
      existingSigningProofVerified = existing === body;
      if (process.env.AUDIT_REQUIRE_EXISTING_SIGNING_PROOF !== "true")
        await proofs.writeOnce(path, body);
      if ((await proofs.read(path)) !== body)
        throw new Error("Signing proof readback mismatch");
    }
    if (probeId) {
      if (!/^[a-f0-9-]{36}$/.test(probeId)) throw new Error("Invalid probe id");
      stage = "blob-write";
      const probes = new BlobCheckpoints(token, "rotation-probes/");
      const body = JSON.stringify({ version: 1, probeId, fingerprint });
      // A changed signer must not overwrite the earlier credential probe.
      const path = `${probeId}${identity?.transition ? `-${fingerprint}` : ""}.json`;
      await probes.writeOnce(path, body);
      if ((await probes.read(path)) !== body)
        throw new Error("Probe readback mismatch");
      probeWritten = true;
    }
    return Response.json({
      ok: true,
      maintenance: true,
      database: true,
      financialInvariants: true,
      financialSnapshotMatchesIncidentBaseline,
      pendingSettlements: Number(stats.pending),
      settledAuctions: Number(stats.settled),
      preRotationConnections: Number(stats.old_connections),
      migrations: Number(stats.migrations),
      blobRead: true,
      blobWriteProbe: probeWritten,
      fingerprint,
      ...identity?.trustMetadata,
      signingProof,
      existingSigningProofVerified,
      existingTransitionArtifactsVerified:
        identity?.requiredArtifactsVerified === true,
      automaticSettlementExecuted: false,
    });
  } catch {
    return Response.json({ ok: false, stage }, { status: 503 });
  } finally {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
    await pool.end();
  }
}
