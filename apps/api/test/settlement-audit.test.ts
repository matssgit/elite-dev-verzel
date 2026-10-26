import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import pg from 'pg';
import { eq } from 'drizzle-orm';
import { env } from '../src/config.js';
import { connect } from '../src/db/client.js';
import { auctions, bids, wallets } from '../src/db/schema.js';
import { register } from '../src/auth/service.js';
import { deposit } from '../src/wallet/service.js';
import { placeBid } from '../src/auctions/service.js';
import { openAudit, appendAudit, auditReport, flushCheckpoints } from '../src/audit/service.js';
import { auditStore, digest } from '../src/audit/store.js';
import { settleAuction, getReceipt, myResults } from '../src/settlement/service.js';
import { buildApp } from '../src/app.js';
import type { ItemSnapshot, PublicUser } from '@elite/shared';

const source=process.env.TEST_DATABASE_URL;if(!source)throw new Error('TEST_DATABASE_URL obrigatório');
// Private PostgreSQL schema prevents a running dev worker from settling test fixtures unexpectedly.
const namespace=`sprint3_${randomUUID().replaceAll('-','')}`;
const url=new URL(source);url.searchParams.set('options',`-c search_path=${namespace}`);
const admin=new pg.Pool({connectionString:source});const {db,pool}=connect(url.toString());
const item:ItemSnapshot={catalogId:'OL1003040W',title:'Livro de fixture',authors:['Autor de fixture'],firstPublishYear:1900,image:null,sourceUrl:'https://openlibrary.org/works/OL1003040W',importedAt:new Date().toISOString()};
let seller:PublicUser;const apps:Awaited<ReturnType<typeof buildApp>>[]=[];
async function account(role:'LEILOEIRO'|'LICITANTE',amount=10000){const user=await register(db,{name:'Pessoa privada',email:`${randomUUID()}@settlement.test`,password:'SenhaTeste2026!',role});if(role==='LICITANTE')await deposit(db,user.id,amount,randomUUID());return user;}
async function fixture(hasBid=true,endsOffset=-1000) {
  const buyer=await account('LICITANTE');const endsAt=new Date(Date.now()+endsOffset);
  const lot=await db.transaction(async tx=>{
    const [lot]=await tx.insert(auctions).values({ownerId:seller.id,item,initialCents:1000,incrementCents:100,startsAt:new Date(endsAt.getTime()-3600000),endsAt,leaderId:hasBid?buyer.id:null,currentCents:hasBid?1000:null,bidCount:hasBid?1:0}).returning();
    await openAudit(tx,lot!);
    if(hasBid){
      const createdAt=new Date(endsAt.getTime()-200000);
      const [bid]=await tx.insert(bids).values({auctionId:lot!.id,bidderId:buyer.id,amountCents:1000,sequence:1,idempotencyKey:randomUUID(),createdAt}).returning();
      await tx.update(wallets).set({committedCents:1000}).where(eq(wallets.userId,buyer.id));
      await appendAudit(tx,lot!.id,{type:'BID',bidId:bid!.id,bidderPublicId:buyer.publicId,amountCents:1000,bidSequence:1,createdAt:createdAt.toISOString(),endsAt:endsAt.toISOString()});
    }
    return lot!;
  });
  await flushCheckpoints(db);return {lot,buyer};
}
beforeAll(async()=>{
  await admin.query(`CREATE SCHEMA ${namespace}`);
  for(const name of ['0001_foundation.sql','0002_auctions.sql','0003_settlement_audit.sql'])await pool.query(await readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
  seller=await account('LEILOEIRO');
},15000);
afterAll(async()=>{for(const app of apps)await app.close();await pool.end();await admin.query(`DROP SCHEMA ${namespace} CASCADE`);await admin.end();});
describe('Liquidação e auditoria — PostgreSQL isolado e checkpoints independentes',()=>{
  it('liquidação duas vezes debita e credita uma única vez, com razão e comprovante consistentes',async()=>{
    const {lot,buyer}=await fixture();
    const before=await pool.query('SELECT total_cents FROM wallets WHERE user_id=$1',[seller.id]);
    const first=await settleAuction(db,lot.id);expect(first.settled).toBe(true);
    expect((await settleAuction(db,lot.id)).settled).toBe(false);await flushCheckpoints(db);
    const balances=await pool.query('SELECT user_id,total_cents,committed_cents FROM wallets WHERE user_id=ANY($1::uuid[])',[[buyer.id,seller.id]]);
    expect(balances.rows.find(r=>r.user_id===buyer.id)).toMatchObject({total_cents:'9000',committed_cents:'0'});
    expect(Number(balances.rows.find(r=>r.user_id===seller.id).total_cents)-Number(before.rows[0].total_cents)).toBe(1000);
    const ledger=await pool.query('SELECT kind,amount_cents FROM wallet_entries WHERE auction_id=$1 ORDER BY kind',[lot.id]);
    expect(ledger.rows).toEqual([{kind:'PURCHASE',amount_cents:'-1000'},{kind:'SALE',amount_cents:'1000'}]);
    const receipt=await getReceipt(db,first.receiptId!);expect(receipt).toMatchObject({amountCents:1000,winnerPublicId:buyer.publicId,verification:'INTEGRO'});
    expect(JSON.stringify(receipt)).not.toContain('Pessoa privada');expect(JSON.stringify(receipt)).not.toContain(buyer.id);
    expect((await auditReport(db,lot.id)).status).toBe('INTEGRO');
  });
  it('oito liquidações concorrentes produzem um comprovante e duas movimentações',async()=>{
    const {lot}=await fixture();const results=await Promise.all(Array.from({length:8},()=>settleAuction(db,lot.id)));
    expect(results.filter(r=>r.settled)).toHaveLength(1);
    expect((await pool.query('SELECT count(*)::int AS n FROM receipts WHERE auction_id=$1',[lot.id])).rows[0].n).toBe(1);
    expect((await pool.query('SELECT count(*)::int AS n FROM wallet_entries WHERE auction_id=$1',[lot.id])).rows[0].n).toBe(2);
  });
  it('encerra sem lances sem vencedor, comprovante ou movimentação',async()=>{
    const {lot}=await fixture(false);expect(await settleAuction(db,lot.id)).toEqual({settled:true,receiptId:null});await flushCheckpoints(db);
    expect((await pool.query('SELECT count(*)::int AS n FROM wallet_entries WHERE auction_id=$1',[lot.id])).rows[0].n).toBe(0);
    const [ended]=await db.select().from(auctions).where(eq(auctions.id,lot.id));expect(ended!.leaderId).toBeNull();expect(ended!.settledAt).not.toBeNull();expect((await auditReport(db,lot.id)).status).toBe('INTEGRO');
  });
  it('lance e encerramento concorrentes não cobram lance fora do prazo',async()=>{
    const {lot}=await fixture();const challenger=await account('LICITANTE');
    const results=await Promise.allSettled([settleAuction(db,lot.id),placeBid(db,challenger,lot.id,1100,randomUUID())]);
    expect(results[0].status).toBe('fulfilled');expect(results[1]).toMatchObject({status:'rejected',reason:{code:'AUCTION_ENDED'}});
    expect((await pool.query('SELECT committed_cents FROM wallets WHERE user_id=$1',[challenger.id])).rows[0].committed_cents).toBe('0');
  });
  it('lance aceito com anti-sniping impede liquidação prematura',async()=>{
    const {lot}=await fixture(true,60000);const challenger=await account('LICITANTE');
    await Promise.all([placeBid(db,challenger,lot.id,1100,randomUUID()),settleAuction(db,lot.id)]);
    const [updated]=await db.select().from(auctions).where(eq(auctions.id,lot.id));
    expect(updated!.settledAt).toBeNull();expect(updated!.endsAt.getTime()-lot.endsAt.getTime()).toBe(120000);
    expect((await pool.query('SELECT count(*)::int AS n FROM receipts WHERE auction_id=$1',[lot.id])).rows[0].n).toBe(0);
  });
  it('detecta alteração de lance e bloqueia transferência financeira',async()=>{
    const {lot,buyer}=await fixture();await pool.query('UPDATE bids SET amount_cents=1500 WHERE auction_id=$1',[lot.id]);
    expect((await auditReport(db,lot.id)).status).toBe('ADULTERADO');
    await expect(settleAuction(db,lot.id)).rejects.toMatchObject({code:'AUDIT_CORRUPTED'});
    expect((await pool.query('SELECT total_cents FROM wallets WHERE user_id=$1',[buyer.id])).rows[0].total_cents).toBe('10000');
  });
  it('detecta exclusão inclusive de todo o histórico e de suas cadeias no banco',async()=>{
    const {lot}=await fixture();await pool.query('DELETE FROM bids WHERE auction_id=$1',[lot.id]);
    await pool.query('DELETE FROM audit_records WHERE auction_id=$1',[lot.id]);
    await pool.query('UPDATE auctions SET bid_count=0,leader_id=NULL,current_cents=NULL WHERE id=$1',[lot.id]);
    const report=await auditReport(db,lot.id);expect(report.status).toBe('ADULTERADO');expect(report.checkpoints).toHaveLength(2);
  });
  it('detecta inserção indevida no histórico',async()=>{
    const {lot,buyer}=await fixture(false);
    await pool.query('INSERT INTO bids(auction_id,bidder_id,amount_cents,sequence,idempotency_key,created_at) VALUES($1,$2,1000,1,$3,now())',[lot.id,buyer.id,randomUUID()]);
    await pool.query('UPDATE auctions SET bid_count=1,leader_id=$2,current_cents=1000 WHERE id=$1',[lot.id,buyer.id]);
    expect((await auditReport(db,lot.id)).status).toBe('ADULTERADO');
  });
  it('checkpoint independente detecta rollback para um prefixo com assinaturas ainda válidas',async()=>{
    const {lot}=await fixture();
    await pool.query('DELETE FROM bids WHERE auction_id=$1',[lot.id]);
    await pool.query('DELETE FROM audit_records WHERE auction_id=$1 AND sequence>0',[lot.id]);
    await pool.query('UPDATE auctions SET bid_count=0,leader_id=NULL,current_cents=NULL WHERE id=$1',[lot.id]);
    const report=await auditReport(db,lot.id);
    expect(report.records).toHaveLength(1);expect((await auditStore()).valid(report.records[0]!)).toBe(true);
    expect(report.status).toBe('ADULTERADO');expect(report.issues.some(issue=>issue.includes('Checkpoint independente 1'))).toBe(true);
  });
  it('reescrever cadeia inteira e seus hashes no banco não substitui checkpoints ou assinaturas',async()=>{
    const {lot}=await fixture();const store=await auditStore();const old=await store.checkpoints(lot.id);
    const payload={...old[1]!.payload,amountCents:7000};
    await pool.query('UPDATE audit_records SET payload=$2,hash=$3 WHERE auction_id=$1 AND sequence=1',[lot.id,payload,digest(payload)]);
    await pool.query('UPDATE bids SET amount_cents=7000 WHERE auction_id=$1',[lot.id]);
    await pool.query('UPDATE auctions SET current_cents=7000 WHERE id=$1',[lot.id]);
    expect((await auditReport(db,lot.id)).status).toBe('ADULTERADO');expect((await store.checkpoints(lot.id))[1]!.hash).toBe(old[1]!.hash);
  });
  it('reinicialização processa lotes vencidos sem timers anteriores e sem cobrança duplicada',async()=>{
    const {lot}=await fixture();
    const first=await buildApp({databaseUrl:url.toString(),webOrigin:env.WEB_ORIGIN,runJobs:true});await first.ready();await first.close();
    expect((await pool.query('SELECT settled_at FROM auctions WHERE id=$1',[lot.id])).rows[0].settled_at).not.toBeNull();
    const second=await buildApp({databaseUrl:url.toString(),webOrigin:env.WEB_ORIGIN,runJobs:true});apps.push(second);await second.ready();
    expect((await pool.query('SELECT count(*)::int AS n FROM wallet_entries WHERE auction_id=$1',[lot.id])).rows[0].n).toBe(2);
    await vi.waitFor(async()=>expect((await auditReport(db,lot.id)).status).toBe('INTEGRO'));
    expect((await myResults(db,seller)).totalReceivedCents).toBeGreaterThanOrEqual(1000);
  });
  it('detecta remoção do lote e recuperação da outbox após publicação interrompida',async()=>{
    const {lot}=await fixture();await pool.query('DELETE FROM bids WHERE auction_id=$1',[lot.id]);await pool.query('DELETE FROM auctions WHERE id=$1',[lot.id]);
    expect((await auditReport(db,lot.id)).status).toBe('ADULTERADO');
    const fresh=await fixture(false,600000);await pool.query('UPDATE audit_records SET published_at=NULL WHERE auction_id=$1',[fresh.lot.id]);await flushCheckpoints(db);
    expect((await auditReport(db,fresh.lot.id)).status).toBe('INTEGRO');
  });
});
