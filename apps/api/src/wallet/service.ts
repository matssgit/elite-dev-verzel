import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { wallets, walletEntries } from "../db/schema.js";
import { AppError } from "../errors.js";
export async function getWallet(db: Database, userId: string) {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId));
  if (!wallet)
    throw new AppError(404, "WALLET_NOT_FOUND", "Carteira não encontrada.");
  return {
    totalCents: wallet.totalCents,
    committedCents: wallet.committedCents,
    availableCents: wallet.totalCents - wallet.committedCents,
  };
}
export async function deposit(
  db: Database,
  userId: string,
  amountCents: number,
  key: string,
) {
  return db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .for("update");
    if (!wallet)
      throw new AppError(404, "WALLET_NOT_FOUND", "Carteira não encontrada.");
    const [existing] = await tx
      .select()
      .from(walletEntries)
      .where(
        and(
          eq(walletEntries.userId, userId),
          eq(walletEntries.idempotencyKey, key),
        ),
      );
    if (existing) {
      if (existing.amountCents !== amountCents)
        throw new AppError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Esta operação já foi usada com outro valor.",
        );
      return {
        totalCents: wallet.totalCents,
        committedCents: wallet.committedCents,
        availableCents: wallet.totalCents - wallet.committedCents,
      };
    }
    if (!Number.isSafeInteger(wallet.totalCents + amountCents))
      throw new AppError(422, "BALANCE_LIMIT", "Limite de saldo atingido.");
    await tx
      .insert(walletEntries)
      .values({ userId, amountCents, kind: "DEPOSIT", idempotencyKey: key });
    const [updated] = await tx
      .update(wallets)
      .set({ totalCents: sql`${wallets.totalCents} + ${amountCents}` })
      .where(eq(wallets.userId, userId))
      .returning();
    if (!updated) throw new Error("Wallet disappeared inside transaction");
    return {
      totalCents: updated.totalCents,
      committedCents: updated.committedCents,
      availableCents: updated.totalCents - updated.committedCents,
    };
  });
}
export async function getEntries(db: Database, userId: string) {
  return db
    .select({
      id: walletEntries.id,
      amountCents: walletEntries.amountCents,
      kind: walletEntries.kind,
      createdAt: walletEntries.createdAt,
    })
    .from(walletEntries)
    .where(eq(walletEntries.userId, userId))
    .orderBy(desc(walletEntries.createdAt), desc(walletEntries.id))
    .limit(50);
}
