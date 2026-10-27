import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { beforeAll,afterAll,it,expect,vi } from 'vitest';
import pg from 'pg';
import { eq } from 'drizzle-orm';
// Only identity pins are substituted: signatures, durable checkpoint writes,
// PostgreSQL transactions, ledger, locks and snapshots are real local fixtures.
vi.mock('../src/audit/incident-pins.js',()=>({incidentPins:{boundaries:[]}}));
vi.mock('../src/audit/store.js',async importOriginal=>{
  const real=await importOriginal<typeof import('../src/audit/store.js')>();
  return {...real,auditStore:async()=>{
    const store=await real.auditStore();
    return new Proxy(store,{get(target,key){
      if(key==='fingerprint')return '07e8ccdec02da616cf480e19a0599271679ed625376bf8968837502b0af94ab2';
      if(key==='signingFingerprint')return ()=> '07e8ccdec02da616cf480e19a0599271679ed625376bf8968837502b0af94ab2';
      if(key==='sign')return (id:string,n:number,prev:string,payload:Record<string,unknown>)=>target.sign(id,n,prev,{...payload,signingKeyFingerprint:'07e8ccdec02da616cf480e19a0599271679ed625376bf8968837502b0af94ab2'});
      const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
    }});
  }};
});
import { connect } from '../src/db/client.js';
import { auctions,bids,wallets } from '../src/db/schema.js';
import { register } from '../src/auth/service.js';
import { deposit } from '../src/wallet/service.js';
import { openAudit,appendAudit,flushCheckpoints } from '../src/audit/service.js';
import { digest } from '../src/audit/store.js';
import { financialSnapshot } from '../src/settlement/controlled-demo.js';
import { processDue } from '../src/settlement/service.js';
import { initializeControl,tick,close,scheduledIdentity,TRIGGER,type Run } from '../src/settlement/scheduled-validation.js';
import { authorizeScheduledPermit,assertScheduledLot,assertScheduledPermit,type ScheduledPermit } from '../src/settlement/scheduled-permit.js';
const source=process.env.TEST_DATABASE_URL;if(!source)throw Error('Local TEST_DATABASE_URL required');
const namespace=`scheduled_${randomUUID().replaceAll('-','')}`,url=new URL(source);url.searchParams.set('options',`-c search_path=${namespace}`);
const admin=new pg.Pool({connectionString:source}),{db,pool}=connect(url.toString());
beforeAll(async()=>{await admin.query(`CREATE SCHEMA ${namespace}`);for(const path of ['0001_foundation.sql','0002_auctions.sql','0003_settlement_audit.sql'])await pool.query(await readFile(new URL(`../migrations/${path}`,import.meta.url),'utf8'));await initializeControl(pool);vi.stubEnv('FINANCIAL_MAINTENANCE','true');},15000);
afterAll(async()=>{vi.unstubAllEnvs();await pool.end();await admin.query(`DROP SCHEMA ${namespace} CASCADE`);await admin.end();});
async function fixture(){
  const baselineHash=digest(await financialSnapshot(pool));
  const seller=await register(db,{name:'Test seller',email:`${randomUUID()}@scheduled.invalid`,password:'TestPassword2026!',role:'LEILOEIRO'});
  const buyer=await register(db,{name:'Test buyer',email:`${randomUUID()}@scheduled.invalid`,password:'TestPassword2026!',role:'LICITANTE'});await deposit(db,buyer.id,10000,randomUUID());
  const endsAt=new Date(Date.now()-90000),createdAt=new Date(Date.now()-100000);
  const item={catalogId:'OL1003040W',title:'Test',authors:[],firstPublishYear:null,image:null,sourceUrl:'https://openlibrary.org/works/OL1003040W',importedAt:createdAt.toISOString()};
  const lot=await db.transaction(async tx=>{
    const [lot]=await tx.insert(auctions).values({ownerId:seller.id,item,initialCents:1000,incrementCents:100,leaderId:buyer.id,currentCents:1000,bidCount:1,startsAt:new Date(+endsAt-600000),endsAt}).returning();await openAudit(tx,lot!);
    const bidTime=new Date(+endsAt-200000),[bid]=await tx.insert(bids).values({auctionId:lot!.id,bidderId:buyer.id,amountCents:1000,sequence:1,idempotencyKey:randomUUID(),createdAt:bidTime}).returning();await tx.update(wallets).set({committedCents:1000}).where(eq(wallets.userId,buyer.id));
    await appendAudit(tx,lot!.id,{type:'BID',bidId:bid!.id,bidderPublicId:buyer.publicId,amountCents:1000,bidSequence:1,createdAt:bidTime.toISOString(),endsAt:endsAt.toISOString()});return lot!;
  });await flushCheckpoints(db,lot.id);
  const run:Run={runId:randomUUID(),auctionId:lot.id,buyerId:buyer.id,sellerId:seller.id,state:'armed',amountCents:1000,admitted:0,createdAt:createdAt.toISOString(),endsAt:endsAt.toISOString(),expiresAt:new Date(Date.now()+300000).toISOString(),baselineHash,preparedHash:digest(await financialSnapshot(pool)),depositId:(await pool.query('SELECT id FROM wallet_entries WHERE user_id=$1',[buyer.id])).rows[0].id,occurrences:[]};
  await pool.query('INSERT INTO scheduled_validation_runs(id,data) VALUES($1,$2::jsonb)',[run.runId,JSON.stringify(run)]);
  return {run,binding:{runId:run.runId,auctionId:run.auctionId,buyerId:run.buyerId,sellerId:run.sellerId,enabled:true}};
}
it('real scoped worker transfers once, next distinct occurrence is idempotent, duplicate delivery does not consume budget',async()=>{
  const {run,binding}=await fixture(),first={invocationId:randomUUID(),scheduledAt:new Date(Date.now()-60000).toISOString()};
  const settled=await tick(db,pool,binding,first);expect(settled.outcome).toBe('settled');expect(settled.evidence).toMatchObject({buyer:{totalCents:9000,committedCents:0},seller:{totalCents:1000,committedCents:0},ledgerEntries:3});
  expect((await tick(db,pool,binding,first)).outcome).toBe('duplicate');
  const before=digest(await financialSnapshot(pool));await new Promise(resolve=>setTimeout(resolve,5));
  const repeated=await tick(db,pool,binding,{invocationId:randomUUID(),scheduledAt:new Date().toISOString()});expect(repeated.outcome).toBe('idempotent');expect(repeated.run.admitted).toBe(2);expect(digest(await financialSnapshot(pool))).toBe(before);
  expect((await tick(db,pool,binding,{invocationId:randomUUID(),scheduledAt:new Date().toISOString()})).outcome).toBe('disarmed');
  await close(pool,run.runId);expect((await tick(db,pool,binding,first)).run.state).toBe('closed');
});
it('parallel delivery has only one claim and never settles another due lot',async()=>{
  const outside=await fixture(),target=await fixture(),occurrence={invocationId:randomUUID(),scheduledAt:new Date().toISOString()};
  const result=await Promise.all([tick(db,pool,target.binding,occurrence),tick(db,pool,target.binding,occurrence)]);expect(result.map(r=>r.outcome).sort()).toEqual(['duplicate','settled']);
  expect((await pool.query('SELECT settled_at FROM auctions WHERE id=$1',[outside.run.auctionId])).rows[0].settled_at).toBeNull();
});
it('persistent executing, expired and closed states never retry finance, even with a new occurrence',async()=>{
  const {run,binding}=await fixture();const before=digest(await financialSnapshot(pool));
  for(const state of ['executing','failed','closed']){await pool.query('UPDATE scheduled_validation_runs SET data=jsonb_set(data,\'{state}\',to_jsonb($2::text)) WHERE id=$1',[run.runId,state]);expect((await tick(db,pool,binding,{invocationId:randomUUID(),scheduledAt:new Date().toISOString()})).outcome).toBe('disarmed');}
  await pool.query("UPDATE scheduled_validation_runs SET data=data || jsonb_build_object('state','armed','createdAt','2000-01-01T00:00:00.000Z','expiresAt','2000-01-01T00:05:00.000Z') WHERE id=$1",[run.runId]);expect((await tick(db,pool,binding,{invocationId:randomUUID(),scheduledAt:new Date().toISOString()})).outcome).toBe('disarmed');expect(digest(await financialSnapshot(pool))).toBe(before);
});
it('mismatched server UUID stops the run before finance; normal worker remains blocked',async()=>{
  const {run,binding}=await fixture();const before=digest(await financialSnapshot(pool));
  expect((await tick(db,pool,{...binding,auctionId:randomUUID()},{invocationId:randomUUID(),scheduledAt:new Date().toISOString()})).outcome).toBe('failed');await processDue(db);expect(digest(await financialSnapshot(pool))).toBe(before);expect((await close(pool,run.runId)).state).toBe('closed');
});
it('rejects forged capabilities, altered participants/value/deadline/budget and late lock admission',async()=>{
  const {run,binding}=await fixture(),now=new Date(),grant={...run,createdAt:new Date(run.createdAt),endsAt:new Date(run.endsAt),expiresAt:new Date(run.expiresAt)};
  const permit=authorizeScheduledPermit(grant,binding,now,now);expect(()=>assertScheduledPermit({...permit} as ScheduledPermit,run.auctionId)).toThrow();
  for(const extra of [{amountCents:1001},{admitted:2},{buyerId:run.sellerId},{sellerId:run.buyerId},{state:'closed'},{expiresAt:new Date(+now-1)},{expiresAt:new Date(+grant.createdAt+600001)}])expect(()=>authorizeScheduledPermit({...grant,...extra},binding,now,now)).toThrow();
  expect(()=>assertScheduledPermit(permit,run.auctionId,new Date(run.expiresAt))).toThrow();
  const lot={id:run.auctionId,ownerId:run.sellerId,leaderId:run.buyerId,currentCents:1000,initialCents:1000,incrementCents:100,bidCount:1,endsAt:new Date(run.endsAt),cancelledAt:null};assertScheduledLot(permit,lot);
  for(const extra of [{currentCents:1001},{ownerId:run.buyerId},{leaderId:run.sellerId},{endsAt:now},{bidCount:2}])expect(()=>assertScheduledLot(permit,{...lot,...extra})).toThrow();
});
it('requires actual provider header/body correlation and the fixed schedule trigger',()=>{
  const request=new Request('https://local.test/',{headers:{'x-neon-trigger-invocation-id':'local-only'}}),body={invocation_id:'local-only',trigger:{id:TRIGGER,type:'schedule'},data:{scheduled_at:new Date().toISOString()}};
  expect(scheduledIdentity(request,body).invocationId).toBe('local-only');expect(()=>scheduledIdentity(request,{...body,invocation_id:'mismatch'})).toThrow();expect(()=>scheduledIdentity(request,{...body,trigger:{id:'other',type:'schedule'}})).toThrow();expect(()=>scheduledIdentity(new Request('https://local.test/'),body)).toThrow();
});
it('expiry is rechecked after waiting on a wallet lock and rolls back without transfer',async()=>{
  const {run,binding}=await fixture(),now=new Date();
  const permit=authorizeScheduledPermit({...run,createdAt:new Date(run.createdAt),endsAt:new Date(run.endsAt),expiresAt:new Date(+now+150)},binding,now,now);
  const locker=await pool.connect();await locker.query('BEGIN');await locker.query('SELECT 1 FROM wallets WHERE user_id=$1 FOR UPDATE',[run.buyerId]);
  const before=digest(await financialSnapshot(pool)),failures:unknown[]=[];
  const working=processDue(db,error=>{failures.push(error);},permit);
  await new Promise(resolve=>setTimeout(resolve,250));await locker.query('ROLLBACK');locker.release();await working;
  expect(failures).toHaveLength(1);expect(digest(await financialSnapshot(pool))).toBe(before);
});
