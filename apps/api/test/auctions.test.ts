import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { env } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { connect } from '../src/db/client.js';
import { catalogItems } from '../src/db/schema.js';
import { login, register } from '../src/auth/service.js';
import { deposit } from '../src/wallet/service.js';
import { statusOf } from '../src/auctions/service.js';
import type { AuctionRoom, ItemSnapshot, Session, Wallet } from '@elite/shared';

const databaseUrl=process.env.TEST_DATABASE_URL;
if(!databaseUrl)throw new Error('TEST_DATABASE_URL obrigatório; aplique as migrations antes dos testes.');
const {db,pool}=connect(databaseUrl);
const emails:string[]=[];const lotIds:string[]=[];
const catalogId=`OL${Date.now()}W`;
const item:ItemSnapshot={catalogId,title:`Livro de teste ${catalogId}`,authors:['Autor de teste'],firstPublishYear:1920,image:null,sourceUrl:`https://openlibrary.org/works/${catalogId}`,importedAt:new Date().toISOString()};
let app:Awaited<ReturnType<typeof buildApp>>;let replica:Awaited<ReturnType<typeof buildApp>>;let seller:Session;
async function account(role:'LEILOEIRO'|'LICITANTE',balance=10_000) {
  const email=`${randomUUID()}@auctions.test`;emails.push(email);
  const user=await register(db,{email,name:'Usuário de teste',password:'TesteLeilao2026!',role});
  if(role==='LICITANTE')await deposit(db,user.id,balance,randomUUID());
  return login(db,email,'TesteLeilao2026!');
}
const headers=(session:Session,key=randomUUID())=>({authorization:`Bearer ${session.token}`,'idempotency-key':key});
async function createLot(overrides:Record<string,unknown>={}) {
  const response=await app.inject({method:'POST',url:'/auctions',headers:headers(seller),payload:{catalogId,initialCents:1000,incrementCents:100,startsAt:new Date(Date.now()-60_000).toISOString(),endsAt:new Date(Date.now()+600_000).toISOString(),...overrides}});
  expect(response.statusCode).toBe(201);const {id}=response.json<{id:string}>();lotIds.push(id);return id;
}
const bid=(session:Session,id:string,amountCents:number,key=randomUUID())=>app.inject({method:'POST',url:`/auctions/${id}/bids`,headers:headers(session,key),payload:{amountCents}});
async function wallet(session:Session){return (await app.inject({url:'/wallet',headers:headers(session)})).json<Wallet>();}
async function room(id:string){return (await app.inject(`/auctions/${id}`)).json<AuctionRoom>();}
beforeAll(async()=>{
  await db.insert(catalogItems).values({id:catalogId,item});
  seller=await account('LEILOEIRO');
  app=await buildApp({databaseUrl:databaseUrl!,webOrigin:env.WEB_ORIGIN});
  replica=await buildApp({databaseUrl:databaseUrl!,webOrigin:env.WEB_ORIGIN});
  await Promise.all([app.ready(),replica.ready()]);
});
afterAll(async()=>{
  vi.unstubAllGlobals();
  if(app)await app.close();if(replica)await replica.close();
  await pool.query('DELETE FROM bids WHERE auction_id=ANY($1::uuid[])',[lotIds]);
  await pool.query('DELETE FROM auctions WHERE id=ANY($1::uuid[])',[lotIds]);
  await pool.query('DELETE FROM catalog_items WHERE id=$1',[catalogId]);
  for(const table of ['wallet_entries','sessions','wallets'])await pool.query(`DELETE FROM ${table} WHERE user_id IN (SELECT id FROM users WHERE email=ANY($1::text[]))`,[emails]);
  await pool.query('DELETE FROM users WHERE email=ANY($1::text[])',[emails]);
  await pool.end();
});
describe('Lances e concorrência — PostgreSQL real',()=>{
  it('serializa dois lances simultâneos no mesmo lote com um único líder',async()=>{
    const a=await account('LICITANTE');const b=await account('LICITANTE');const id=await createLot();
    const results=await Promise.all([bid(a,id,1000),bid(b,id,1000)]);
    expect(results.map(r=>r.statusCode).sort()).toEqual([201,422]);
    const current=await room(id);expect(current.bids).toHaveLength(1);expect(current.auction.bidCount).toBe(1);
    const balances=await Promise.all([wallet(a),wallet(b)]);
    expect(balances.map(w=>w.committedCents).sort((x,y)=>x-y)).toEqual([0,1000]);
    expect(balances.reduce((sum,w)=>sum+w.totalCents,0)).toBe(20000);
  });
  it('serializa o mesmo usuário em lotes diferentes sem gastar além do disponível',async()=>{
    const a=await account('LICITANTE',10000);const x=await createLot();const y=await createLot();
    const results=await Promise.all([bid(a,x,7500),bid(a,y,7500)]);
    expect(results.map(r=>r.statusCode).sort()).toEqual([201,422]);
    expect(results.find(r=>r.statusCode===422)!.json().code).toBe('INSUFFICIENT_FUNDS');
    expect(await wallet(a)).toEqual({totalCents:10000,committedCents:7500,availableCents:2500});
    const {rows}=await pool.query('SELECT sum(current_cents)::int AS total FROM auctions WHERE leader_id=$1',[a.user.id]);
    expect(rows[0].total).toBe(7500);
  });
  it('libera exatamente a reserva do líder anterior ao superar seu lance',async()=>{
    const a=await account('LICITANTE');const b=await account('LICITANTE');const id=await createLot();
    expect((await bid(a,id,1000)).statusCode).toBe(201);expect((await wallet(a)).availableCents).toBe(9000);
    expect((await bid(b,id,1100)).statusCode).toBe(201);
    expect(await wallet(a)).toEqual({totalCents:10000,committedCents:0,availableCents:10000});
    expect(await wallet(b)).toEqual({totalCents:10000,committedCents:1100,availableCents:8900});
    const current=await room(id);expect(current.auction.leaderPublicId).toBe(b.user.publicId);expect(current.bids.map(b=>b.sequence)).toEqual([2,1]);
  });
  it('outbids cruzados em dois lotes seguem a mesma ordem de bloqueios sem deadlock',async()=>{
    const a=await account('LICITANTE');const b=await account('LICITANTE');const x=await createLot();const y=await createLot();
    await bid(a,x,1000);await bid(b,y,1000);
    const results=await Promise.all([bid(a,y,1100),bid(b,x,1100)]);
    expect(results.every(r=>r.statusCode===201)).toBe(true);
    expect((await wallet(a)).committedCents).toBe(1100);expect((await wallet(b)).committedCents).toBe(1100);
    expect((await room(x)).auction.leaderPublicId).toBe(b.user.publicId);
    expect((await room(y)).auction.leaderPublicId).toBe(a.user.publicId);
  });
  it('rejeita saldo insuficiente sem gravar lance nem reserva',async()=>{
    const a=await account('LICITANTE',500);const id=await createLot();const result=await bid(a,id,1000);
    expect(result.statusCode).toBe(422);expect(result.json().code).toBe('INSUFFICIENT_FUNDS');
    expect((await wallet(a)).committedCents).toBe(0);expect((await room(id)).bids).toHaveLength(0);
  });
  it('rejeita autossuperação sem alterar o histórico ou saldo',async()=>{
    const a=await account('LICITANTE');const id=await createLot();await bid(a,id,1000);
    const result=await bid(a,id,1500);expect(result.statusCode).toBe(409);expect(result.json().code).toBe('ALREADY_LEADING');
    expect((await wallet(a)).committedCents).toBe(1000);expect((await room(id)).bids).toHaveLength(1);
  });
  it('respeita lance inicial, incremento, papel e janela de participação',async()=>{
    const a=await account('LICITANTE');const b=await account('LICITANTE');const id=await createLot();
    expect((await bid(a,id,999)).json().code).toBe('BID_TOO_LOW');
    expect((await bid(a,id,1000)).statusCode).toBe(201);
    expect((await bid(b,id,1099)).json().code).toBe('BID_TOO_LOW');
    expect((await bid(seller,id,1100)).statusCode).toBe(403);
    const future=await createLot({startsAt:new Date(Date.now()+300_000).toISOString()});
    expect((await bid(a,future,1000)).json().code).toBe('AUCTION_NOT_STARTED');
    const expired=await createLot();
    await pool.query("UPDATE auctions SET starts_at=now()-interval '2 hours', ends_at=now()-interval '1 hour' WHERE id=$1",[expired]);
    expect((await bid(a,expired,1000)).json().code).toBe('AUCTION_ENDED');
  });
  it('prorroga exatamente 120 segundos somente nos últimos 120 segundos',async()=>{
    const a=await account('LICITANTE');const b=await account('LICITANTE');
    const id=await createLot({endsAt:new Date(Date.now()+90_000).toISOString()});const before=await room(id);
    expect((await bid(a,id,1000)).statusCode).toBe(201);const after=await room(id);
    expect(Date.parse(after.auction.endsAt)-Date.parse(before.auction.endsAt)).toBe(120000);
    expect((await bid(b,id,1100)).statusCode).toBe(201);
    expect((await room(id)).auction.endsAt).toBe(after.auction.endsAt);
  });
  it('revalida horário após esperar pelo bloqueio da carteira',async()=>{
    const a=await account('LICITANTE');const id=await createLot({endsAt:new Date(Date.now()+600).toISOString()});
    const blocker=await pool.connect();await blocker.query('BEGIN');
    try {
      await blocker.query('SELECT * FROM wallets WHERE user_id=$1 FOR UPDATE',[a.user.id]);
      const pending=bid(a,id,1000);
      // Keep the wallet locked past the auction deadline; transaction start time must not authorize a late bid.
      await blocker.query('SELECT pg_sleep(0.9)');await blocker.query('COMMIT');
      const result=await pending;expect(result.json().code).toBe('AUCTION_ENDED');
      expect((await wallet(a)).committedCents).toBe(0);expect((await room(id)).bids).toHaveLength(0);
    } finally {await blocker.query('ROLLBACK');blocker.release();}
  });
  it('idempotência de lance impede reaplicação e detecta chave divergente',async()=>{
    const a=await account('LICITANTE');const id=await createLot();const key=randomUUID();
    const results=await Promise.all([bid(a,id,1000,key),bid(a,id,1000,key)]);
    expect(results.every(r=>r.statusCode===201)).toBe(true);expect(results[0]!.json()).toEqual(results[1]!.json());
    expect((await room(id)).bids).toHaveLength(1);expect((await wallet(a)).committedCents).toBe(1000);
    expect((await bid(a,id,1100,key)).json().code).toBe('IDEMPOTENCY_CONFLICT');
  });
  it('cancela somente lote próprio sem lances e o oculta da vitrine',async()=>{
    const stranger=await account('LEILOEIRO');const a=await account('LICITANTE');const id=await createLot();
    expect((await app.inject({method:'POST',url:`/auctions/${id}/cancel`,headers:headers(stranger)})).statusCode).toBe(403);
    expect((await app.inject({method:'POST',url:`/auctions/${id}/cancel`,headers:headers(seller)})).statusCode).toBe(200);
    expect((await bid(a,id,1000)).json().code).toBe('AUCTION_CANCELLED');
    expect((await app.inject('/auctions')).json().auctions.some((a:{id:string})=>a.id===id)).toBe(false);
    const active=await createLot();await bid(a,active,1000);
    expect((await app.inject({method:'POST',url:`/auctions/${active}/cancel`,headers:headers(seller)})).json().code).toBe('HAS_BIDS');
  });
  it('WebSocket de outra instância recebe lance confirmado por LISTEN/NOTIFY',async()=>{
    const a=await account('LICITANTE');const id=await createLot();const messages:{type:string;auctionId?:string}[]=[];
    const ws=await replica.injectWS(`/auctions/${id}/events`,{}, {onInit:socket=>socket.on('message',raw=>messages.push(JSON.parse(raw.toString())))});
    try {
      expect((await bid(a,id,1000)).statusCode).toBe(201);
      await vi.waitFor(()=>expect(messages.some(m=>m.type==='auction.updated'&&m.auctionId===id)).toBe(true),{timeout:2000});
      const current=await room(id);expect(current.auction.bidCount).toBe(1);
      expect(JSON.stringify(current)).not.toContain(a.user.name);expect(JSON.stringify(current)).not.toContain(a.user.id);
      const count=messages.filter(m=>m.type==='auction.updated').length;
      expect((await bid(a,id,1100)).json().code).toBe('ALREADY_LEADING');
      expect(messages.filter(m=>m.type==='auction.updated')).toHaveLength(count);
    } finally {ws.terminate();}
  });
  it('snapshot do lote continua disponível sem catálogo externo',async()=>{
    const id=await createLot();vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('External API down')));
    try {
      const response=await app.inject({url:`/catalog?q=${encodeURIComponent(item.title)}`,headers:headers(seller)});
      expect(response.statusCode).toBe(200);expect(response.json().cached).toBe(true);
      expect((await room(id)).auction.item).toEqual(item);
      expect((await app.inject({url:'/catalog?q=zzzznevercached',headers:headers(seller)})).statusCode).toBe(503);
    } finally {vi.unstubAllGlobals();}
  });
  it('fronteiras temporais são início inclusivo e fim exclusivo',async()=>{
    const now=new Date();const fake={cancelledAt:null,startsAt:now,endsAt:new Date(now.getTime()+1000)} as Parameters<typeof statusOf>[0];
    expect(statusOf(fake,now)).toBe('AO_VIVO');expect(statusOf(fake,fake.endsAt)).toBe('ENCERRADO');
    const result=await db.execute(sql`SELECT count(*)::int AS n FROM bids WHERE amount_cents < 1`);expect(result.rows[0]!.n).toBe(0);
  });
});
