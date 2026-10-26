import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Auction, AuctionStatus, PublicUser, createAuctionSchema } from '@elite/shared';
import type { Database } from '../db/client.js';
import { auctions, bids, catalogItems, users, wallets } from '../db/schema.js';
import { AppError } from '../errors.js';
import { appendAudit, assertHistory, openAudit } from '../audit/service.js';

export function statusOf(auction:typeof auctions.$inferSelect,now:Date):AuctionStatus {
  if(auction.cancelledAt)return 'CANCELADO';
  if(now<auction.startsAt)return 'AGENDADO';
  return now<auction.endsAt?'AO_VIVO':'ENCERRADO';
}
function toPublic(auction:typeof auctions.$inferSelect,leaderPublicId:string|null,now:Date):Auction {
  return {id:auction.id,item:auction.item,initialCents:auction.initialCents,incrementCents:auction.incrementCents,currentCents:auction.currentCents,leaderPublicId,bidCount:auction.bidCount,startsAt:auction.startsAt.toISOString(),endsAt:auction.endsAt.toISOString(),cancelledAt:auction.cancelledAt?.toISOString()??null,settledAt:auction.settledAt?.toISOString()??null,status:statusOf(auction,now)};
}
export function requireRole(user:PublicUser,role:'LEILOEIRO'|'LICITANTE') {
  if(user.role!==role)throw new AppError(403,'FORBIDDEN',role==='LEILOEIRO'?'Apenas leiloeiros podem gerenciar lotes.':'Apenas licitantes podem oferecer lances.');
}
export async function createAuction(db:Database,user:PublicUser,input:z.infer<typeof createAuctionSchema>) {
  requireRole(user,'LEILOEIRO');
  return db.transaction(async tx=>{
    const [source]=await tx.select().from(catalogItems).where(eq(catalogItems.id,input.catalogId));
    if(!source)throw new AppError(400,'CATALOG_ITEM_NOT_FOUND','Pesquise e selecione um item do catálogo antes de criar o lote.');
    const time=await tx.execute<{now:Date}>(sql`SELECT clock_timestamp() AS now`);
    if(new Date(input.endsAt)<=new Date(time.rows[0]!.now))throw new AppError(400,'INVALID_DATES','O encerramento precisa estar no futuro.');
    const [auction]=await tx.insert(auctions).values({ownerId:user.id,item:source.item,initialCents:input.initialCents,incrementCents:input.incrementCents,startsAt:new Date(input.startsAt),endsAt:new Date(input.endsAt)}).returning();
    await openAudit(tx,auction!);
    await tx.execute(sql`SELECT pg_notify('auction_events', ${JSON.stringify({auctionId:auction!.id})})`);
    return {id:auction!.id};
  });
}
export async function listAuctions(db:Database,ownerId?:string,participantId?:string) {
  // One SQL statement gives a consistent snapshot and the same DB clock for all status labels.
  const query=db.select({auction:auctions,leaderPublicId:users.publicId,now:sql<Date>`statement_timestamp()`}).from(auctions).leftJoin(users,eq(users.id,auctions.leaderId)).where(ownerId?eq(auctions.ownerId,ownerId):participantId?inArray(auctions.id,db.select({id:bids.auctionId}).from(bids).where(eq(bids.bidderId,participantId))):isNull(auctions.cancelledAt)).orderBy(desc(auctions.createdAt));
  const rows=await (ownerId||participantId?query:query.limit(100));
  const time=rows[0]?.now??(await db.execute<{now:Date}>(sql`SELECT clock_timestamp() AS now`)).rows[0]!.now;
  const now=new Date(time);
  return {auctions:rows.map(r=>toPublic(r.auction,r.leaderPublicId,now)),serverTime:now.toISOString()};
}
export async function getRoom(db:Database,id:string) {
  // Read-only repeatable snapshot avoids mixing a leader from one bid with history from another.
  return db.transaction(async tx=>{
    const [row]=await tx.select({auction:auctions,leaderPublicId:users.publicId}).from(auctions).leftJoin(users,eq(users.id,auctions.leaderId)).where(eq(auctions.id,id));
    if(!row)throw new AppError(404,'AUCTION_NOT_FOUND','Lote não encontrado.');
    const history=await tx.select({id:bids.id,bidderPublicId:users.publicId,amountCents:bids.amountCents,sequence:bids.sequence,createdAt:bids.createdAt}).from(bids).innerJoin(users,eq(users.id,bids.bidderId)).where(eq(bids.auctionId,id)).orderBy(desc(bids.sequence));
    const time=await tx.execute<{now:Date}>(sql`SELECT clock_timestamp() AS now`);
    const now=new Date(time.rows[0]!.now);
    return {auction:toPublic(row.auction,row.leaderPublicId,now),bids:history.map(b=>({...b,createdAt:b.createdAt.toISOString()})),serverTime:now.toISOString()};
  },{isolationLevel:'repeatable read',accessMode:'read only'});
}
export async function cancelAuction(db:Database,user:PublicUser,id:string) {
  requireRole(user,'LEILOEIRO');
  return db.transaction(async tx=>{
    const [auction]=await tx.select().from(auctions).where(eq(auctions.id,id)).for('update');
    if(!auction)throw new AppError(404,'AUCTION_NOT_FOUND','Lote não encontrado.');
    if(auction.ownerId!==user.id)throw new AppError(403,'NOT_OWNER','Você só pode cancelar os seus próprios lotes.');
    if(auction.bidCount>0)throw new AppError(409,'HAS_BIDS','Lotes que já receberam lances não podem ser cancelados.');
    if(!auction.cancelledAt) {
      await assertHistory(tx,auction);
      const [updated]=await tx.update(auctions).set({cancelledAt:sql`clock_timestamp()`}).where(eq(auctions.id,id)).returning();
      await appendAudit(tx,id,{type:'CANCEL',cancelledAt:updated!.cancelledAt!.toISOString()});
      await tx.execute(sql`SELECT pg_notify('auction_events',${JSON.stringify({auctionId:id})})`);
    }
    return {id};
  });
}

export async function placeBid(db:Database,user:PublicUser,id:string,amountCents:number,key:string) {
  requireRole(user,'LICITANTE');
  return db.transaction(async tx=>{
    // Global order: one auction, then all involved wallets ordered by UUID. Deposits lock only a wallet.
    const [auction]=await tx.select().from(auctions).where(eq(auctions.id,id)).for('update');
    if(!auction)throw new AppError(404,'AUCTION_NOT_FOUND','Lote não encontrado.');
    const walletIds=[...new Set([user.id,...(auction.leaderId?[auction.leaderId]:[])])].sort();
    const locked=await tx.select().from(wallets).where(inArray(wallets.userId,walletIds)).orderBy(asc(wallets.userId)).for('update');
    const [existing]=await tx.select().from(bids).where(and(eq(bids.bidderId,user.id),eq(bids.idempotencyKey,key)));
    if(existing) {
      if(existing.auctionId!==id || existing.amountCents!==amountCents)throw new AppError(409,'IDEMPOTENCY_CONFLICT','Esta operação já foi usada com outro lance.');
      return {bidId:existing.id};
    }
    // Must be read AFTER every blocking lock: transaction_timestamp() would be stale after waiting.
    const result=await tx.execute<{now:Date}>(sql`SELECT clock_timestamp() AS now`);
    const now=new Date(result.rows[0]!.now);
    const state=statusOf(auction,now);
    if(state==='CANCELADO')throw new AppError(409,'AUCTION_CANCELLED','Este lote foi cancelado.');
    if(state==='AGENDADO')throw new AppError(409,'AUCTION_NOT_STARTED','Este leilão ainda não começou.');
    if(state==='ENCERRADO')throw new AppError(409,'AUCTION_ENDED','Este leilão já foi encerrado.');
    if(auction.leaderId===user.id)throw new AppError(409,'ALREADY_LEADING','Você já está ganhando este lote.');
    const minimum=auction.currentCents===null?auction.initialCents:auction.currentCents+auction.incrementCents;
    if(!Number.isSafeInteger(amountCents) || amountCents<minimum || amountCents>100_000_000)throw new AppError(422,'BID_TOO_LOW',`O lance mínimo é ${(minimum/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}.`);
    const bidder=locked.find(w=>w.userId===user.id);
    if(!bidder || bidder.totalCents-bidder.committedCents<amountCents)throw new AppError(422,'INSUFFICIENT_FUNDS','Saldo disponível insuficiente. Faça um depósito simulado na carteira.');
    await assertHistory(tx,auction);
    if(auction.leaderId && auction.currentCents!==null) {
      await tx.update(wallets).set({committedCents:sql`${wallets.committedCents} - ${auction.currentCents}`}).where(eq(wallets.userId,auction.leaderId));
    }
    await tx.update(wallets).set({committedCents:sql`${wallets.committedCents} + ${amountCents}`}).where(eq(wallets.userId,user.id));
    const endsAt=auction.endsAt.getTime()-now.getTime()<=120_000?new Date(auction.endsAt.getTime()+120_000):auction.endsAt;
    const [bid]=await tx.insert(bids).values({auctionId:id,bidderId:user.id,amountCents,sequence:auction.bidCount+1,idempotencyKey:key,createdAt:now}).returning({id:bids.id});
    await appendAudit(tx,id,{type:'BID',bidId:bid!.id,bidderPublicId:user.publicId,amountCents,bidSequence:auction.bidCount+1,createdAt:now.toISOString(),endsAt:endsAt.toISOString()});
    await tx.update(auctions).set({currentCents:amountCents,leaderId:user.id,bidCount:auction.bidCount+1,endsAt}).where(eq(auctions.id,id));
    // PostgreSQL emits NOTIFY only after COMMIT; rolled-back operations produce no event.
    await tx.execute(sql`SELECT pg_notify('auction_events',${JSON.stringify({auctionId:id})})`);
    return {bidId:bid!.id};
  });
}
