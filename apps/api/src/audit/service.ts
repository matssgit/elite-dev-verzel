import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { AuditRecord, AuditReport } from '@elite/shared';
import type { Database } from '../db/client.js';
import { auctions, bids, users, auditRecords, receipts } from '../db/schema.js';
import { AppError } from '../errors.js';
import { auditStore, digest, type AuditStore } from './store.js';
export type Transaction=Parameters<Parameters<Database['transaction']>[0]>[0];
type Lot=typeof auctions.$inferSelect;
export const lotIdentity=(lot:Lot)=>({itemHash:digest(lot.item),initialCents:lot.initialCents,incrementCents:lot.incrementCents,startsAt:lot.startsAt.toISOString(),ownerIdHash:digest(lot.ownerId)});
export async function appendAudit(tx:Transaction,lotId:string,payload:Record<string,unknown>) {
  const store=await auditStore();
  const [previous]=await tx.select().from(auditRecords).where(eq(auditRecords.auctionId,lotId)).orderBy(desc(auditRecords.sequence)).limit(1);
  const record=store.sign(lotId,previous?previous.sequence+1:0,previous?.hash??'0'.repeat(64),payload);
  await tx.insert(auditRecords).values(record);return record;
}
export async function initializeAudit(tx:Transaction,lot:Lot) {
  const [root]=await tx.select().from(auditRecords).where(and(eq(auditRecords.auctionId,lot.id),eq(auditRecords.sequence,0)));
  if(root)return;
  const store=await auditStore();
  if(lot.auditVersion!==0 || (await store.checkpoints(lot.id)).length)throw new AppError(409,'AUDIT_CORRUPTED','Evidência de auditoria ausente ou divergente. Operação bloqueada.');
  await openAudit(tx,lot,true);
  const history=await tx.select({bid:bids,publicId:users.publicId}).from(bids).innerJoin(users,eq(users.id,bids.bidderId)).where(eq(bids.auctionId,lot.id)).orderBy(asc(bids.sequence));
  for(const {bid,publicId} of history)await appendAudit(tx,lot.id,{type:'BID',bidId:bid.id,bidderPublicId:publicId,amountCents:bid.amountCents,bidSequence:bid.sequence,createdAt:bid.createdAt.toISOString(),endsAt:lot.endsAt.toISOString()});
  if(lot.cancelledAt)await appendAudit(tx,lot.id,{type:'CANCEL',cancelledAt:lot.cancelledAt.toISOString()});
  await tx.update(auctions).set({auditVersion:1}).where(eq(auctions.id,lot.id));
}
export async function openAudit(tx:Transaction,lot:Lot,legacyBaseline=false) {
  return appendAudit(tx,lot.id,{type:'OPEN',...lotIdentity(lot),endsAt:lot.endsAt.toISOString(),legacyBaseline});
}
export async function checkHistory(tx:Transaction,lot:Lot,store:AuditStore):Promise<Omit<AuditReport,'status'|'publicKey'|'fingerprint'>> {
  const rows=await tx.select().from(auditRecords).where(eq(auditRecords.auctionId,lot.id)).orderBy(asc(auditRecords.sequence));
  const records=rows.map(row=>({...row,payload:row.payload&&typeof row.payload==='object'&&!Array.isArray(row.payload)?row.payload:{}}));
  const history=await tx.select({bid:bids,publicId:users.publicId}).from(bids).innerJoin(users,eq(users.id,bids.bidderId)).where(eq(bids.auctionId,lot.id)).orderBy(asc(bids.sequence));
  const issues:string[]=[];let checkpoints:AuditRecord[]=[];
  try{checkpoints=await store.checkpoints(lot.id);}catch{issues.push('Não foi possível ler os checkpoints independentes.');}
  let previous='0'.repeat(64);
  for(const [index,record] of records.entries()) {
    if(record.sequence!==index || record.previousHash!==previous || !store.valid(record))issues.push(`Cadeia ou assinatura inválida no evento ${record.sequence}.`);
    previous=record.hash;
  }
  try{store.assertBoundary(records,lot.id);}catch{issues.push('Fronteira de transição ausente, divergente ou revertida.');}
  const root=records[0];
  if(!root || root.payload.type!=='OPEN' || Object.entries(lotIdentity(lot)).some(([key,value])=>root.payload[key]!==value))issues.push('Identidade do lote diverge da abertura assinada.');
  const events=records.filter(r=>r.payload.type==='BID');
  if(events.length!==history.length || history.length!==lot.bidCount)issues.push('Quantidade de lances diverge do histórico assinado.');
  for(const [index,{bid,publicId}] of history.entries()) {
    const event=events[index]?.payload;
    if(!event || event.bidId!==bid.id || event.bidderPublicId!==publicId || event.amountCents!==bid.amountCents || event.bidSequence!==bid.sequence || bid.sequence!==index+1 || event.createdAt!==bid.createdAt.toISOString())issues.push(`Lance ${bid.sequence} alterado, removido ou inserido sem assinatura correspondente.`);
  }
  const last=history.at(-1);
  if((last?.bid.bidderId??null)!==lot.leaderId || (last?.bid.amountCents??null)!==lot.currentCents)issues.push('Liderança/valor divergem do último lance.');
  if((events.at(-1)?.payload.endsAt??root?.payload.endsAt)!==lot.endsAt.toISOString())issues.push('Prazo do lote diverge do registro assinado.');
  const cancellation=records.find(r=>r.payload.type==='CANCEL');
  if((cancellation?.payload.cancelledAt??null)!==(lot.cancelledAt?.toISOString()??null))issues.push('Cancelamento diverge do registro assinado.');
  const settlement=records.find(r=>r.payload.type==='SETTLE');
  if((settlement?.payload.settledAt??null)!==(lot.settledAt?.toISOString()??null))issues.push('Liquidação diverge do registro assinado.');
  if(settlement) {
    const [receipt]=await tx.select().from(receipts).where(eq(receipts.auctionId,lot.id));
    if(settlement.payload.amountCents!==lot.currentCents || settlement.payload.winnerPublicId!==(last?.publicId??null) || settlement.payload.endedAt!==lot.endsAt.toISOString() || settlement.payload.itemHash!==digest(lot.item))issues.push('Resultado diverge do checkpoint final.');
    if(!lot.leaderId && receipt)issues.push('Comprovante indevido em lote sem vencedor.');
    if(lot.leaderId && (!receipt || receipt.id!==settlement.payload.receiptId || receipt.winnerId!==lot.leaderId || receipt.winnerPublicId!==last?.publicId || receipt.amountCents!==lot.currentCents || receipt.endedAt.toISOString()!==lot.endsAt.toISOString() || receipt.settledAt.toISOString()!==lot.settledAt?.toISOString() || digest(receipt.item)!==digest(lot.item)))issues.push('Comprovante diverge do resultado assinado.');
  }
  for(const checkpoint of checkpoints) {
    const record=records[checkpoint.sequence];
    if(!store.valid(checkpoint) || !record || record.hash!==checkpoint.hash || record.signature!==checkpoint.signature)issues.push(`Checkpoint independente ${checkpoint.sequence} diverge do banco.`);
  }
  return {auctionId:lot.id,records:records.map(({auctionId,sequence,previousHash,payload,hash,signature})=>({auctionId,sequence,previousHash,payload,hash,signature})),checkpoints,issues,legacyBaseline:root?.payload.legacyBaseline===true};
}
export async function assertHistory(tx:Transaction,lot:Lot) {
  await initializeAudit(tx,lot);
  const report=await checkHistory(tx,lot,await auditStore());
  if(report.issues.length)throw new AppError(409,'AUDIT_CORRUPTED','Histórico ou checkpoint divergente. Operação financeira bloqueada.');
}
export async function flushCheckpoints(db:Database,auctionId?:string) {
  const store=await auditStore();
  const pending=await db.select().from(auditRecords).where(auctionId?and(isNull(auditRecords.publishedAt),eq(auditRecords.auctionId,auctionId)):isNull(auditRecords.publishedAt)).orderBy(asc(auditRecords.auctionId),asc(auditRecords.sequence)).limit(500);
  for(const record of pending) {
    const clean:AuditRecord={auctionId:record.auctionId,sequence:record.sequence,previousHash:record.previousHash,payload:record.payload,hash:record.hash,signature:record.signature};
    await store.publish(clean);
    await db.update(auditRecords).set({publishedAt:new Date()}).where(and(eq(auditRecords.auctionId,record.auctionId),eq(auditRecords.sequence,record.sequence),eq(auditRecords.hash,record.hash)));
  }
}
export async function auditReport(db:Database,id:string):Promise<AuditReport> {
  const store=await auditStore();
  return db.transaction(async tx=>{
    const [lot]=await tx.select().from(auctions).where(eq(auctions.id,id)).for('share');
    if(!lot) {
      const checkpoints=await store.checkpoints(id);
      if(!checkpoints.length)throw new AppError(404,'AUCTION_NOT_FOUND','Lote não encontrado.');
      return {auctionId:id,status:'ADULTERADO',issues:['Lote removido do banco, mas existem checkpoints independentes.'],records:[],checkpoints,publicKey:store.publicKey,fingerprint:store.fingerprint,legacyBaseline:checkpoints[0]?.payload.legacyBaseline===true,...store.trustMetadata};
    }
    const report=await checkHistory(tx,lot,store);
    const anchored=report.records.length>0 && report.checkpoints.length===report.records.length;
    return {...report,status:report.issues.length?'ADULTERADO':anchored?'INTEGRO':'PENDENTE',publicKey:store.publicKey,fingerprint:store.fingerprint,...store.trustMetadata,signatureKeys:report.records.map(r=>({sequence:r.sequence,fingerprint:store.signingFingerprint(r)}))};
  });
}
