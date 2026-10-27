import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { auctions, bids, receipts, users, wallets, walletEntries } from '../db/schema.js';
import { AppError } from '../errors.js';
import { appendAudit, assertHistory, initializeAudit, flushCheckpoints, auditReport } from '../audit/service.js';
import { digest } from '../audit/store.js';
import { listAuctions } from '../auctions/service.js';
import type { PublicUser, Receipt } from '@elite/shared';

export async function settleAuction(db:Database,id:string) {
  return db.transaction(async tx=>{
    const [lot]=await tx.select().from(auctions).where(eq(auctions.id,id)).for('update');
    if(!lot || lot.cancelledAt || lot.settledAt)return {settled:false};
    const walletIds=[...new Set([lot.ownerId,...(lot.leaderId?[lot.leaderId]:[])])].sort();
    const locked=await tx.select().from(wallets).where(inArray(wallets.userId,walletIds)).orderBy(asc(wallets.userId)).for('update');
    const result=await tx.execute<{now:Date}>(sql`SELECT clock_timestamp() AS now`);const now=new Date(result.rows[0]!.now);
    if(now<lot.endsAt)return {settled:false};
    await assertHistory(tx,lot);
    let receiptId:string|null=null;let winnerPublicId:string|null=null;
    if(lot.leaderId && lot.currentCents!==null) {
      const [winning]=await tx.select({bid:bids,publicId:users.publicId}).from(bids).innerJoin(users,eq(users.id,bids.bidderId)).where(eq(bids.auctionId,id)).orderBy(desc(bids.sequence)).limit(1);
      if(!winning || winning.bid.bidderId!==lot.leaderId || winning.bid.amountCents!==lot.currentCents || winning.bid.sequence!==lot.bidCount)throw new AppError(409,'SETTLEMENT_INCONSISTENT','O lance vencedor diverge do lote.');
      const buyer=locked.find(w=>w.userId===lot.leaderId);const seller=locked.find(w=>w.userId===lot.ownerId);const amount=lot.currentCents;
      if(!buyer || !seller || buyer.committedCents<amount || buyer.totalCents<amount || !Number.isSafeInteger(seller.totalCents+amount))throw new AppError(409,'SETTLEMENT_INCONSISTENT','Saldo/reserva inconsistentes para liquidação.');
      // Check reservation equals the sum of ALL this bidder's unsettled leaderships, not just this lot.
      // Read only: every transaction altering this user's leadership already holds this wallet lock.
      const reserved=await tx.execute<{total:string}>(sql`SELECT COALESCE(sum(current_cents),0)::text AS total FROM auctions WHERE leader_id=${lot.leaderId} AND settled_at IS NULL AND cancelled_at IS NULL`);
      if(Number(reserved.rows[0]!.total)!==buyer.committedCents)throw new AppError(409,'SETTLEMENT_INCONSISTENT','Comprometimento total diverge dos lotes liderados.');
      receiptId=randomUUID();winnerPublicId=winning.publicId;
      await tx.update(wallets).set({totalCents:sql`${wallets.totalCents} - ${amount}`,committedCents:sql`${wallets.committedCents} - ${amount}`}).where(eq(wallets.userId,lot.leaderId));
      await tx.update(wallets).set({totalCents:sql`${wallets.totalCents} + ${amount}`}).where(eq(wallets.userId,lot.ownerId));
      await tx.insert(walletEntries).values([
        {userId:lot.leaderId,amountCents:-amount,kind:'PURCHASE',auctionId:id,idempotencyKey:receiptId},
        {userId:lot.ownerId,amountCents:amount,kind:'SALE',auctionId:id,idempotencyKey:receiptId},
      ]);
      await tx.insert(receipts).values({id:receiptId,auctionId:id,winnerId:lot.leaderId,winnerPublicId,item:lot.item,amountCents:amount,endedAt:lot.endsAt,settledAt:now});
    }
    await tx.update(auctions).set({settledAt:now}).where(eq(auctions.id,id));
    await appendAudit(tx,id,{type:'SETTLE',receiptId,winnerPublicId,amountCents:lot.currentCents,endedAt:lot.endsAt.toISOString(),settledAt:now.toISOString(),itemHash:digest(lot.item)});
    await tx.execute(sql`SELECT pg_notify('auction_events',${JSON.stringify({auctionId:id})})`);
    return {settled:true,receiptId};
  });
}
export async function processDue(db:Database,onError:(error:unknown)=>void=()=>{}) {
  if(process.env.FINANCIAL_MAINTENANCE==='true')return;
  const legacy=await db.select({id:auctions.id}).from(auctions).where(eq(auctions.auditVersion,0)).limit(100);
  for(const {id} of legacy)try{
    await db.transaction(async tx=>{const [lot]=await tx.select().from(auctions).where(eq(auctions.id,id)).for('update');if(lot)await initializeAudit(tx,lot);});
  }catch(error){onError(error);}
  const due=await db.select({id:auctions.id}).from(auctions).where(and(isNull(auctions.settledAt),isNull(auctions.cancelledAt),sql`${auctions.endsAt} <= clock_timestamp()`)).orderBy(asc(auctions.endsAt)).limit(100);
  for(const {id} of due)try{await settleAuction(db,id);}catch(error){onError(error);}
  try{await flushCheckpoints(db);}catch(error){onError(error);}
}
export async function getReceipt(db:Database,id:string):Promise<Receipt> {
  const [row]=await db.select().from(receipts).where(eq(receipts.id,id));
  if(!row)throw new AppError(404,'RECEIPT_NOT_FOUND','Comprovante não encontrado.');
  const report=await auditReport(db,row.auctionId);const record=report.records.find(r=>r.payload.type==='SETTLE');
  if(!record)throw new AppError(409,'AUDIT_CORRUPTED','Não há registro de liquidação verificável.');
  return {id:row.id,auctionId:row.auctionId,item:row.item,amountCents:row.amountCents,winnerPublicId:row.winnerPublicId,endedAt:row.endedAt.toISOString(),settledAt:row.settledAt.toISOString(),record,verification:report.status,signingFingerprint:report.signatureKeys?.find(k=>k.sequence===record.sequence)?.fingerprint??report.fingerprint,transitionHash:report.transitionHash};
}
export async function myResults(db:Database,user:PublicUser) {
  const all=await listAuctions(db,user.role==='LEILOEIRO'?user.id:undefined,user.role==='LICITANTE'?user.id:undefined);
  const won=await db.select().from(receipts).where(user.role==='LEILOEIRO'?inArray(receipts.auctionId,all.auctions.map(a=>a.id)):eq(receipts.winnerId,user.id));
  const participated=user.role==='LICITANTE'?await db.selectDistinct({id:bids.auctionId}).from(bids).where(eq(bids.bidderId,user.id)):[];
  const ids=new Set(participated.map(p=>p.id));
  const results=all.auctions.filter(a=>user.role==='LEILOEIRO'||ids.has(a.id)).map(auction=>{const receipt=won.find(r=>r.auctionId===auction.id);return {auction,receiptId:receipt?.id??null,won:receipt?.winnerId===user.id,amountCents:receipt?.amountCents??null};});
  const totalReceivedCents=user.role==='LEILOEIRO'?won.reduce((sum,r)=>sum+r.amountCents,0):0;
  return {results,totalReceivedCents};
}
