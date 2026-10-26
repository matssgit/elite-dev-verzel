import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import pg from 'pg';
import { env } from '../src/config.js';
import { buildApp } from '../src/app.js';
import type { Session, Wallet } from '@elite/shared';

const databaseUrl=process.env.TEST_DATABASE_URL;
if(!databaseUrl) throw new Error('TEST_DATABASE_URL deve apontar para PostgreSQL com migrations aplicadas.');
const pool=new pg.Pool({connectionString:databaseUrl});
const emails:string[]=[];
let app:Awaited<ReturnType<typeof buildApp>>;
let bidder:Session;let other:Session;let seller:Session;
const password='TesteSeguro2026!';
async function account(role:'LICITANTE'|'LEILOEIRO') {
  const email=`${randomUUID()}@integration.test`;emails.push(email);
  const result=await app.inject({method:'POST',url:'/auth/register',payload:{name:'Teste Integração',email,password,role}});
  expect(result.statusCode).toBe(201);
  expect(result.json().user).not.toHaveProperty('passwordHash');
  const login=await app.inject({method:'POST',url:'/auth/login',payload:{email,password}});
  expect(login.statusCode).toBe(200);return login.json<Session>();
}
function headers(s:Session,key=randomUUID()){return {authorization:`Bearer ${s.token}`,'idempotency-key':key};}
async function balance(s:Session){return (await app.inject({method:'GET',url:'/wallet',headers:headers(s)})).json<Wallet>();}
beforeAll(async()=>{
  app=await buildApp({databaseUrl:databaseUrl!,webOrigin:env.WEB_ORIGIN});
  bidder=await account('LICITANTE');other=await account('LICITANTE');seller=await account('LEILOEIRO');
});
afterAll(async()=>{
  if(app)await app.close();
  // Only remove records created by this test; never truncate shared QA/development data.
  for(const table of ['wallet_entries','sessions','wallets'])await pool.query(`DELETE FROM ${table} WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))`,[emails]);
  await pool.query('DELETE FROM users WHERE email = ANY($1::text[])',[emails]);
  await pool.end();
});
describe('Fundação em PostgreSQL real',()=>{
  it('verifica saúde, sessão sem exposição de email e senha, e saldo inicial',async()=>{
    expect((await app.inject('/health')).statusCode).toBe(200);
    const me=await app.inject({url:'/auth/me',headers:headers(bidder)});
    expect(me.statusCode).toBe(200);expect(me.json().user.role).toBe('LICITANTE');
    expect(me.json().user).not.toHaveProperty('email');
    expect(await balance(bidder)).toEqual({totalCents:0,committedCents:0,availableCents:0});
  });
  it('impede acesso sem sessão e operação financeira do leiloeiro',async()=>{
    expect((await app.inject('/wallet')).statusCode).toBe(401);
    expect((await app.inject({url:'/wallet',headers:headers(seller)})).statusCode).toBe(403);
    expect((await app.inject({method:'POST',url:'/wallet/deposits',headers:headers(seller),payload:{amountCents:100}})).statusCode).toBe(403);
  });
  it('recusa email duplicado, senha errada e validação de cadastro',async()=>{
    expect((await app.inject({method:'POST',url:'/auth/register',payload:{name:'Teste',email:emails[0]!.toUpperCase(),password,role:'LICITANTE'}})).statusCode).toBe(409);
    expect((await app.inject({method:'POST',url:'/auth/login',payload:{email:emails[0],password:'OutraSenhaErrada'}})).statusCode).toBe(401);
    expect((await app.inject({method:'POST',url:'/auth/register',payload:{name:'X',email:'bad',password:'123',role:'ADMIN'}})).statusCode).toBe(400);
  });
  it('rejeita depósito inválido sem alterar saldo',async()=>{
    for(const amountCents of [-1,0,99,100.5,100_000_001])expect((await app.inject({method:'POST',url:'/wallet/deposits',headers:headers(bidder),payload:{amountCents}})).statusCode).toBe(400);
    expect((await app.inject({method:'POST',url:'/wallet/deposits',headers:{authorization:`Bearer ${bidder.token}`},payload:{amountCents:100}})).statusCode).toBe(400);
    expect((await balance(bidder)).totalCents).toBe(0);
  });
  it('aplica uma única vez pedidos simultâneos com a mesma chave e detecta conflito',async()=>{
    const key=randomUUID();
    const results=await Promise.all(Array.from({length:8},()=>app.inject({method:'POST',url:'/wallet/deposits',headers:headers(bidder,key),payload:{amountCents:12345}})));
    expect(results.every(r=>r.statusCode===200)).toBe(true);
    expect((await balance(bidder)).totalCents).toBe(12345);
    const conflict=await app.inject({method:'POST',url:'/wallet/deposits',headers:headers(bidder,key),payload:{amountCents:500}});
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().code).toBe('IDEMPOTENCY_CONFLICT');
  });
  it('não perde atualização em depósitos paralelos distintos e isola carteiras',async()=>{
    const results=await Promise.all(Array.from({length:12},()=>app.inject({method:'POST',url:'/wallet/deposits',headers:headers(bidder),payload:{amountCents:100}})));
    expect(results.every(r=>r.statusCode===200)).toBe(true);
    expect(await balance(bidder)).toEqual({totalCents:13545,availableCents:13545,committedCents:0});
    expect((await balance(other)).totalCents).toBe(0);
    const ledger=await app.inject({url:'/wallet/entries',headers:headers(bidder)});
    expect(ledger.json().entries).toHaveLength(13);
    const {rows}=await pool.query('SELECT sum(amount_cents)::text AS total FROM wallet_entries WHERE user_id=$1',[bidder.user.id]);
    expect(rows[0].total).toBe('13545');
  });
  it('banco impede comprometimento maior que total',async()=>{
    await expect(pool.query('UPDATE wallets SET committed_cents=total_cents+1 WHERE user_id=$1',[bidder.user.id])).rejects.toMatchObject({code:'23514'});
    expect((await balance(bidder)).committedCents).toBe(0);
  });
  it('manutenção bloqueia mutações financeiras e preserva leitura sem alterar saldo',async()=>{
    const before=await balance(bidder);vi.stubEnv('FINANCIAL_MAINTENANCE','true');
    try {
      for(const url of ['/wallet/deposits','/auctions',`/auctions/${randomUUID()}/bids`,`/auctions/${randomUUID()}/cancel`]) {
        const response=await app.inject({method:'POST',url,headers:headers(bidder),payload:{amountCents:1000}});
        expect(response.statusCode).toBe(503);expect(response.json().code).toBe('MAINTENANCE');
      }
      expect(await balance(bidder)).toEqual(before);
      expect((await app.inject({url:'/health'})).statusCode).toBe(200);
    }finally{vi.unstubAllEnvs();}
    expect((await app.inject({method:'POST',url:'/wallet/deposits',payload:{amountCents:1000}})).statusCode).toBe(401);
  });
  it('sessão expirada ou revogada não pode operar',async()=>{
    await pool.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",[other.user.id]);
    expect((await app.inject({url:'/wallet',headers:headers(other)})).statusCode).toBe(401);
    expect((await app.inject({method:'POST',url:'/auth/logout',headers:headers(bidder)})).statusCode).toBe(204);
    expect((await app.inject({url:'/auth/me',headers:headers(bidder)})).statusCode).toBe(401);
  });
});
