import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { connect } from '../db/client.js';
import { authenticate } from '../auth/service.js';
import { auditReport, flushCheckpoints } from '../audit/service.js';
import { digest } from '../audit/store.js';
import { settleAuction } from './service.js';

export const DEMO_LOT='00000000-0000-4000-8000-000000000100';
const OLD_HEAD='216183c4a3f7f2a44356c55a4c26867a887be6ae87c28fddefa0cec1f913b8eb';
type Row=Record<string,unknown>;
type Snapshot=Record<'wallets'|'wallet_entries'|'auctions'|'bids'|'receipts'|'audit_records',Row[]>;
export async function financialSnapshot(pool:Pool):Promise<Snapshot> {
  const client=await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot={} as Snapshot;
    for(const [table,order]of Object.entries({wallets:'user_id',wallet_entries:'id',auctions:'id',bids:'id',receipts:'id',audit_records:'auction_id,sequence'})) {
      const result=await client.query<{rows:Row[]}>(`SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY ${order}),'[]'::jsonb) AS rows FROM ${table} t`);
      snapshot[table as keyof Snapshot]=result.rows[0]!.rows;
    }
    await client.query('ROLLBACK');return snapshot;
  }finally{client.release();}
}
function requireThat(value:unknown):asserts value {if(!value)throw new Error('Controlled verification failed');}
const number=(row:Row,key:string)=>Number(row[key]);
export function verifyDemoDelta(before:Snapshot,after:Snapshot,buyerId:string,sellerId:string) {
  const wallet=(state:Snapshot,id:string)=>state.wallets.find(w=>w.user_id===id)!;
  const b0=wallet(before,buyerId),b1=wallet(after,buyerId),s0=wallet(before,sellerId),s1=wallet(after,sellerId);
  requireThat(b0&&b1&&s0&&s1);
  requireThat(number(b1,'total_cents')===number(b0,'total_cents')-5000&&number(b1,'committed_cents')===number(b0,'committed_cents')-5000);
  requireThat(number(s1,'total_cents')===number(s0,'total_cents')+5000&&s1.committed_cents===s0.committed_cents);
  requireThat(digest(before.wallets.filter(w=>![buyerId,sellerId].includes(String(w.user_id))))===digest(after.wallets.filter(w=>![buyerId,sellerId].includes(String(w.user_id)))));
  const outside=(rows:Row[])=>rows.filter(r=>r.auction_id!==DEMO_LOT);
  for(const key of ['wallet_entries','receipts','audit_records'] as const)requireThat(digest(outside(before[key]))===digest(outside(after[key])));
  requireThat(digest(before.bids)===digest(after.bids));
  const strip=(state:Snapshot)=>state.auctions.map(r=>r.id===DEMO_LOT?{...r,settled_at:null}:r);
  requireThat(digest(strip(before))===digest(strip(after)));
  const entries=after.wallet_entries.filter(r=>r.auction_id===DEMO_LOT);
  requireThat(entries.length===2&&entries.some(e=>e.kind==='PURCHASE'&&e.user_id===buyerId&&number(e,'amount_cents')===-5000)&&entries.some(e=>e.kind==='SALE'&&e.user_id===sellerId&&number(e,'amount_cents')===5000));
  const receipts=after.receipts.filter(r=>r.auction_id===DEMO_LOT);
  requireThat(receipts.length===1&&receipts[0]!.winner_id===buyerId&&number(receipts[0]!,'amount_cents')===5000);
  const previous=before.audit_records.filter(r=>r.auction_id===DEMO_LOT),records=after.audit_records.filter(r=>r.auction_id===DEMO_LOT);
  requireThat(previous.length===2&&records.length===3&&digest(previous)===digest(records.slice(0,2)));
  requireThat((records[2]!.payload as Row).type==='SETTLE'&&records[2]!.published_at!==null);
  return {buyer:{beforeTotal:number(b0,'total_cents'),afterTotal:number(b1,'total_cents'),beforeReserved:number(b0,'committed_cents'),afterReserved:number(b1,'committed_cents'),debitCents:5000},seller:{beforeTotal:number(s0,'total_cents'),afterTotal:number(s1,'total_cents'),creditCents:5000},ledgerEntries:entries.length,receiptId:String(receipts[0]!.id),unexpectedFinancialChanges:false};
}

// Temporary operator-armed entry point. The original scheduler and API remain
// blocked. No caller-selected lot, value, identity or signature key is accepted.
export async function controlledDemo(request:Request):Promise<Response> {
  const expected=process.env.CONTROLLED_DEMO_SESSION_HASH,deadline=Date.parse(process.env.CONTROLLED_DEMO_UNTIL??'');
  if(process.env.FINANCIAL_MAINTENANCE!=='true'||!expected||!Number.isFinite(deadline)||Date.now()>deadline)return new Response('Not found',{status:404});
  if(request.method!=='POST')return new Response('Method not allowed',{status:405});
  const auth=request.headers.get('authorization')??'',token=/^Bearer ([a-f0-9]{64})$/.exec(auth)?.[1];
  if(!token||createHash('sha256').update(token).digest('hex')!==expected)return new Response('Forbidden',{status:403});
  const url=process.env.DATABASE_URL_UNPOOLED??process.env.DATABASE_URL;
  if(!url)return Response.json({ok:false,stage:'configuration'},{status:503});
  const {db,pool}=connect(url);let lock:PoolClient|undefined,stage='authorization',committed=false;
  try {
    const operator=await authenticate(db,auth);
    lock=await pool.connect();
    requireThat((await lock.query('SELECT pg_try_advisory_lock(51005,5000) AS acquired')).rows[0]?.acquired);
    stage='demo-preflight';const before=await financialSnapshot(pool);
    const lot=before.auctions.find(a=>a.id===DEMO_LOT);requireThat(lot);
    const identities=await pool.query('SELECT id,email,role FROM users WHERE id=ANY($1::uuid[])',[[lot.owner_id,lot.leader_id]]);
    requireThat(identities.rows.some(u=>u.id===lot.owner_id&&u.id===operator.id&&u.email==='leiloeiro@demo.local'&&u.role==='LEILOEIRO'));
    requireThat(identities.rows.some(u=>u.id===lot.leader_id&&u.email==='ana@demo.local'&&u.role==='LICITANTE'));
    requireThat(number(lot,'current_cents')===5000&&number(lot,'initial_cents')===5000&&number(lot,'bid_count')===1&&!lot.cancelled_at&&!lot.settled_at);
    requireThat(!before.receipts.some(r=>r.auction_id===DEMO_LOT)&&!before.wallet_entries.some(r=>r.auction_id===DEMO_LOT));
    const prior=await auditReport(db,DEMO_LOT);
    requireThat(prior.status==='INTEGRO'&&prior.records.length===2&&prior.records[1]?.hash===OLD_HEAD&&prior.checkpoints.length===2);
    stage='first-settlement';const first=await settleAuction(db,DEMO_LOT);committed=first.settled;requireThat(first.settled&&first.receiptId);
    stage='checkpoint-publication';await flushCheckpoints(db,DEMO_LOT);
    stage='first-verification';const after=await financialSnapshot(pool);
    const evidence=verifyDemoDelta(before,after,String(lot.leader_id),String(lot.owner_id));
    const report=await auditReport(db,DEMO_LOT);
    requireThat(report.status==='INTEGRO'&&report.records.length===3&&report.checkpoints.length===3&&report.records.filter(r=>r.payload.type==='SETTLE').length===1);
    stage='idempotency';const second=await settleAuction(db,DEMO_LOT);requireThat(!second.settled);
    await flushCheckpoints(db,DEMO_LOT);
    const repeated=await financialSnapshot(pool);requireThat(digest(after)===digest(repeated));
    return Response.json({ok:true,demonstrationOnly:true,realMoneyMoved:false,maintenance:true,auctionId:DEMO_LOT,...evidence,firstSettled:true,secondSettled:false,idempotent:true,financialSnapshotAfter:digest(after),financialSnapshotRepeated:digest(repeated),audit:{status:report.status,events:3,checkpoints:3,settlementEvents:1,head:report.records[2]!.hash,fingerprint:report.fingerprint},cronChanged:false});
  }catch{return Response.json({ok:false,stage,committed,maintenance:true},{status:503});}
  finally {if(lock){await lock.query('SELECT pg_advisory_unlock(51005,5000)').catch(()=>{});lock.release();}await pool.end();}
}
