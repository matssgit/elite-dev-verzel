import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import process from 'node:process';
import console from 'node:console';
import WebSocket from 'ws';
import { setTimeout,clearTimeout } from 'node:timers';
const {fetch,AbortSignal}=globalThis;

// Creates only labelled, disposable validation accounts/lots; never edits demo lots.
const base=process.env.SMOKE_API_URL;const origin=process.env.SMOKE_WEB_ORIGIN;
if(!base || !origin)throw new Error('Set SMOKE_API_URL and SMOKE_WEB_ORIGIN');
async function call(path,token,body,method=body?'POST':'GET',key) {
  const headers={Origin:origin};if(token)headers.Authorization=`Bearer ${token}`;
  if(body)headers['Content-Type']='application/json';if(key)headers['Idempotency-Key']=key;
  const res=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});
  const result=res.status===204?null:await res.json();return {status:res.status,body:result,cors:res.headers.get('access-control-allow-origin')};
}
const tag=Date.now();const people=[];
for(const [index,role] of ['LEILOEIRO','LICITANTE','LICITANTE','LICITANTE','LICITANTE'].entries()) {
  const email=`verificacao-${tag}-${index}@validation.test`;const password='DemoVerzel2026!';
  const created=await call('/auth/register',null,{email,password,name:`Validação deploy ${index}`,role});assert.equal(created.status,201,JSON.stringify(created));
  const login=await call('/auth/login',null,{email,password});assert.equal(login.status,200);assert.equal(login.cors,origin);
  people.push({...login.body,email});
  if(index && index!==4)assert.equal((await call('/wallet/deposits',login.body.token,{amountCents:10000},'POST',randomUUID())).status,200);
}
const [seller,a,b,c,empty]=people;
const catalog=await call('/catalog?q=Dom%20Casmurro',seller.token);assert.equal(catalog.status,200);assert.ok(catalog.body.items.length);
const catalogId=catalog.body.items[0].id;
async function lot(initialCents=1000,minutes=4){const res=await call('/auctions',seller.token,{catalogId,initialCents,incrementCents:100,startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+minutes*60000).toISOString()});assert.equal(res.status,201,JSON.stringify(res));return res.body.id;}
const main=await lot();
const sockets=[];const messages=[];
for(let i=0;i<2;i++)await new Promise((resolve,reject)=>{const ws=new WebSocket(base.replace('https:','wss:')+`/auctions/${main}/events`,{origin});sockets.push(ws);const timeout=setTimeout(()=>reject(new Error('WS timeout')),20000);ws.on('error',reject);ws.on('message',data=>{messages.push({client:i,...JSON.parse(String(data))});clearTimeout(timeout);resolve();});});
const results=await Promise.all([a,b].map(p=>call(`/auctions/${main}/bids`,p.token,{amountCents:1000},'POST',randomUUID())));
assert.equal(results.filter(r=>r.status===201).length,1,JSON.stringify(results));
const previous=results[0].status===201?a:b;const leader=previous===a?b:a;
assert.equal((await call(`/auctions/${main}/bids`,leader.token,{amountCents:1100},'POST',randomUUID())).status,201);
assert.equal((await call('/wallet',previous.token)).body.committedCents,0);
assert.equal((await call('/wallet',leader.token)).body.committedCents,1100);
assert.equal((await call(`/auctions/${main}/bids`,leader.token,{amountCents:1200},'POST',randomUUID())).body.code,'ALREADY_LEADING');
assert.equal((await call(`/auctions/${main}/bids`,empty.token,{amountCents:1200},'POST',randomUUID())).body.code,'INSUFFICIENT_FUNDS');
const one=await lot(7000);const two=await lot(7000);
const parallel=await Promise.all([one,two].map(id=>call(`/auctions/${id}/bids`,previous.token,{amountCents:7000},'POST',randomUUID())));
assert.equal(parallel.filter(r=>r.status===201).length,1,JSON.stringify(parallel));assert.equal(parallel.filter(r=>r.body.code==='INSUFFICIENT_FUNDS').length,1);
const future=await lot(1000,30);assert.equal((await call(`/auctions/${future}/bids`,c.token,{amountCents:1000},'POST',randomUUID())).status,201);
const audit=await call(`/audit/${main}`);assert.equal(audit.body.status,'INTEGRO');
const showcase=await call('/auctions');assert.ok(showcase.body.auctions.some(l=>l.id===main));
// HTTP response waits for checkpoint publication, so notifications have had time to arrive.
assert.ok(messages.some(m=>m.client===0&&m.type==='auction.updated'));assert.ok(messages.some(m=>m.client===1&&m.type==='auction.updated'));
for(const ws of sockets)ws.close();
for(const person of people)await call('/auth/logout',person.token,undefined,'POST');
const evidence={createdAt:new Date().toISOString(),base,origin,main,concurrentLots:[one,two],idleLot:future,accounts:people.map(({user,email})=>({user,email})),fingerprint:audit.body.fingerprint,checkpointHashes:audit.body.checkpoints.map(r=>r.hash),checks:{login:true,cors:true,catalog:true,showcase:true,sameLotRace:true,crossLotRace:true,previousLeaderReleased:true,selfOutbidRejected:true,noFundsRejected:true,twoWebSocketClients:true},messages:messages.length};
await writeFile('tmp/production-evidence.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
