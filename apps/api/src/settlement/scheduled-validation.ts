import { randomBytes,randomUUID,createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type { Database } from '../db/client.js';
import { authenticate,register } from '../auth/service.js';
import { createAuction,placeBid } from '../auctions/service.js';
import { deposit } from '../wallet/service.js';
import { auditReport,flushCheckpoints } from '../audit/service.js';
import { auditStore,digest } from '../audit/store.js';
import { incidentPins } from '../audit/incident-pins.js';
import { financialSnapshot } from './controlled-demo.js';
import { authorizeScheduledPermit,requireValidation,type ValidationBinding } from './scheduled-permit.js';
import { processDue } from './service.js';

export const ACTIVE_KEY='07e8ccdec02da616cf480e19a0599271679ed625376bf8968837502b0af94ab2';
export const MANIFEST='126e42c16b21a5b7e3256c507e96eead53bb0a956e94f741928b04505c0e25a1';
export const TRIGGER='trigger-81af7a75-3b54-4914-ad70-d410cfb95939';
type Snapshot=Awaited<ReturnType<typeof financialSnapshot>>;
export type Run={runId:string;state:string;createdAt:string;expiresAt:string;endsAt:string;auctionId:string;buyerId:string;sellerId:string;amountCents:number;admitted:number;baselineHash:string;preparedHash:string;settledHash?:string;depositId?:string;receiptId?:string;occurrences:{invocationId:string;scheduledAt:string;outcome:string}[];failure?:string;closedAt?:string};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
// Persistent metadata, deliberately separate from the financial tables. A claim
// is committed BEFORE finance: a crash leaves 'executing', which cannot retry.
export async function initializeControl(pool:Pool){
  await pool.query(`CREATE TABLE IF NOT EXISTS scheduled_validation_runs (id uuid PRIMARY KEY, data jsonb NOT NULL,
    CHECK (data->>'runId'=id::text), CHECK ((data->>'amountCents')::int=1000),
    CHECK ((data->>'admitted')::int BETWEEN 0 AND 2),
    CHECK ((data->>'expiresAt')::timestamptz>(data->>'createdAt')::timestamptz AND (data->>'expiresAt')::timestamptz<=(data->>'createdAt')::timestamptz+interval '10 minutes'),
    CHECK (data->>'state' IN ('preparing','prepared','armed','executing','complete','failed','closed')))`);
}
async function save(pool:Pool,run:Run){await pool.query('UPDATE scheduled_validation_runs SET data=$2::jsonb WHERE id=$1',[run.runId,JSON.stringify(run)]);}
async function now(pool:Pool){return (await pool.query<{now:Date}>('SELECT clock_timestamp() AS now')).rows[0]!.now;}
export function outsideHash(snapshot:Snapshot,run:Pick<Run,'auctionId'|'buyerId'|'sellerId'|'depositId'>){
  const copy={...snapshot};
  copy.wallets=snapshot.wallets.filter(r=>r.user_id!==run.buyerId&&r.user_id!==run.sellerId);
  copy.auctions=snapshot.auctions.filter(r=>r.id!==run.auctionId);
  for(const table of ['bids','receipts','audit_records'] as const)copy[table]=snapshot[table].filter(r=>r.auction_id!==run.auctionId);
  copy.wallet_entries=snapshot.wallet_entries.filter(r=>r.auction_id!==run.auctionId&&r.id!==run.depositId);
  return digest(copy);
}
export function verifyFixture(snapshot:Snapshot,run:Run,settled:boolean,expectedFingerprint=ACTIVE_KEY){
  requireValidation(outsideHash(snapshot,run)===run.baselineHash);
  const buyer=snapshot.wallets.find(r=>r.user_id===run.buyerId),seller=snapshot.wallets.find(r=>r.user_id===run.sellerId);
  requireValidation(buyer&&seller&&Number(buyer.total_cents)===(settled?9000:10000)&&Number(buyer.committed_cents)===(settled?0:1000)&&Number(seller.total_cents)===(settled?1000:0)&&Number(seller.committed_cents)===0);
  const lot=snapshot.auctions.find(r=>r.id===run.auctionId);requireValidation(lot&&lot.owner_id===run.sellerId&&lot.leader_id===run.buyerId&&Number(lot.current_cents)===1000&&Number(lot.initial_cents)===1000&&Number(lot.increment_cents)===100&&Number(lot.bid_count)===1&&!lot.cancelled_at&&Boolean(lot.settled_at)===settled&&new Date(String(lot.ends_at)).toISOString()===run.endsAt);
  const bids=snapshot.bids.filter(r=>r.auction_id===run.auctionId||r.bidder_id===run.buyerId||r.bidder_id===run.sellerId);
  requireValidation(bids.length===1&&bids[0]!.auction_id===run.auctionId&&bids[0]!.bidder_id===run.buyerId&&Number(bids[0]!.amount_cents)===1000);
  const entries=snapshot.wallet_entries.filter(r=>r.auction_id===run.auctionId||r.user_id===run.buyerId||r.user_id===run.sellerId);
  requireValidation(entries.length===(settled?3:1)&&entries.some(r=>r.id===run.depositId&&r.kind==='DEPOSIT'&&r.user_id===run.buyerId&&r.auction_id===null&&Number(r.amount_cents)===10000));
  if(settled)requireValidation(entries.some(r=>r.kind==='PURCHASE'&&r.user_id===run.buyerId&&r.auction_id===run.auctionId&&Number(r.amount_cents)===-1000)&&entries.some(r=>r.kind==='SALE'&&r.user_id===run.sellerId&&r.auction_id===run.auctionId&&Number(r.amount_cents)===1000));
  const receipts=snapshot.receipts.filter(r=>r.auction_id===run.auctionId);requireValidation(receipts.length===(settled?1:0));
  if(settled)requireValidation(receipts[0]!.winner_id===run.buyerId&&Number(receipts[0]!.amount_cents)===1000&&receipts[0]!.settled_at===lot.settled_at);
  const records=snapshot.audit_records.filter(r=>r.auction_id===run.auctionId);
  requireValidation(records.length===(settled?3:2)&&records.every(r=>r.published_at&&(r.payload as Record<string,unknown>).signingKeyFingerprint===expectedFingerprint));
  requireValidation(records.map(r=>(r.payload as Record<string,unknown>).type).join(',')===(settled?'OPEN,BID,SETTLE':'OPEN,BID'));
  return {buyer:{totalCents:Number(buyer.total_cents),committedCents:Number(buyer.committed_cents)},seller:{totalCents:Number(seller.total_cents),committedCents:Number(seller.committed_cents)},receiptId:settled?String(receipts[0]!.id):null,ledgerEntries:entries.length,outsideDataUnchanged:true,financialHash:digest(snapshot)};
}
export async function verifyHistorical(db:Database){
  for(const boundary of incidentPins.boundaries){const report=await auditReport(db,boundary.auctionId);requireValidation(report.status==='INTEGRO'&&report.records.length===boundary.events&&report.checkpoints.length===boundary.checkpoints&&report.records.at(-1)?.hash===boundary.hash);}
}
export function configuredBinding():ValidationBinding{return {runId:process.env.SCHEDULED_VALIDATION_RUN_ID??'',auctionId:process.env.SCHEDULED_VALIDATION_AUCTION_ID??'',buyerId:process.env.SCHEDULED_VALIDATION_BUYER_ID??'',sellerId:process.env.SCHEDULED_VALIDATION_SELLER_ID??'',enabled:process.env.SCHEDULED_VALIDATION_ENABLED==='true'};}
export function configurationSafe(){return process.env.FINANCIAL_MAINTENANCE==='true'&&process.env.RUN_SETTLEMENT_JOBS==='false'&&process.env.AUDIT_RECOVERY_MODE==='false'&&process.env.AUDIT_PUBLIC_KEY_FINGERPRINT===ACTIVE_KEY&&process.env.AUDIT_TRANSITION_SHA256===MANIFEST&&process.env.AUDIT_REQUIRE_EXISTING_TRANSITION==='true'&&process.env.AUDIT_REQUIRE_EXISTING_SIGNING_PROOF==='true';}
export async function operatorAuthorized(db:Database,request:Request){
  const auth=request.headers.get('authorization')??'',token=/^Bearer ([a-f0-9]{64})$/.exec(auth)?.[1];
  if(!token||createHash('sha256').update(token).digest('hex')!==process.env.SCHEDULED_VALIDATION_SESSION_HASH)return false;
  const user=await authenticate(db,auth);const match=await db.execute<{ok:boolean}>((await import('drizzle-orm')).sql`SELECT EXISTS(SELECT 1 FROM users WHERE id=${user.id} AND email='leiloeiro@demo.local' AND role='LEILOEIRO') AS ok`);return match.rows[0]?.ok===true;
}
// Never accept request-selected financial parameters. All IDs originate here;
// arming subsequently requires an immutable server binding to these exact IDs.
export async function prepare(db:Database,pool:Pool,runId:string){
  requireValidation(uuid.test(runId));await initializeControl(pool);
  const createdAt=await now(pool);const run:Run={runId,state:'preparing',createdAt:createdAt.toISOString(),expiresAt:new Date(+createdAt+600000).toISOString(),endsAt:'',auctionId:'',buyerId:'',sellerId:'',amountCents:1000,admitted:0,baselineHash:'',preparedHash:'',occurrences:[]};
  await pool.query('INSERT INTO scheduled_validation_runs(id,data) VALUES($1,$2::jsonb)',[runId,JSON.stringify(run)]);
  try{
    await verifyHistorical(db);const initial=await financialSnapshot(pool);run.baselineHash=digest(initial);requireValidation(run.baselineHash===incidentPins.knownFinancialSnapshotHash);
    const source=(await pool.query('SELECT id FROM catalog_items ORDER BY id LIMIT 1')).rows[0];requireValidation(source);
    const seller=await register(db,{name:'Vendedor exclusivo ensaio agendado',email:`seller-${runId}@validation.invalid`,password:randomBytes(32).toString('hex'),role:'LEILOEIRO'});run.sellerId=seller.id;await save(pool,run);
    const buyer=await register(db,{name:'Comprador exclusivo ensaio agendado',email:`buyer-${runId}@validation.invalid`,password:randomBytes(32).toString('hex'),role:'LICITANTE'});run.buyerId=buyer.id;await save(pool,run);
    const key=randomUUID();await deposit(db,buyer.id,10000,key);run.depositId=(await pool.query('SELECT id FROM wallet_entries WHERE user_id=$1 AND idempotency_key=$2',[buyer.id,key])).rows[0]!.id;await save(pool,run);
    const time=await now(pool);run.endsAt=new Date(+time+240000).toISOString();
    run.auctionId=(await createAuction(db,seller,{catalogId:source.id,initialCents:1000,incrementCents:100,startsAt:new Date(+time-1000).toISOString(),endsAt:run.endsAt})).id;await save(pool,run);
    await placeBid(db,buyer,run.auctionId,1000,randomUUID());await flushCheckpoints(db,run.auctionId);
    verifyFixture(await financialSnapshot(pool),run,false);run.preparedHash=digest(await financialSnapshot(pool));run.state='prepared';await save(pool,run);return run;
  }catch{run.state='failed';run.failure='preparation';await save(pool,run);throw new Error('Preparation failed; do not retry');}
}
export async function withRun<T>(pool:Pool,id:string,callback:(run:Run)=>Promise<T>):Promise<T>{
  const lock=await pool.connect();
  try{
    // Session lock survives commits to the claim row, serializing all controls
    // and scheduler invocations without an uncommitted financial authorization.
    await lock.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[`scheduled-validation:${id}`]);
    const run=(await lock.query<{data:Run}>('SELECT data FROM scheduled_validation_runs WHERE id=$1',[id])).rows[0]?.data;requireValidation(run);return await callback(run);
  }finally{await lock.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[`scheduled-validation:${id}`]).catch(()=>{});lock.release();}
}
export async function arm(pool:Pool,binding:ValidationBinding){return withRun(pool,binding.runId,async run=>{
  requireValidation(!binding.enabled&&run.state==='prepared');for(const k of ['runId','auctionId','buyerId','sellerId'] as const)requireValidation(binding[k]===run[k]&&uuid.test(binding[k]));
  requireValidation(await now(pool)<new Date(run.expiresAt));verifyFixture(await financialSnapshot(pool),run,false);run.state='armed';await save(pool,run);return run;
});}
export async function close(pool:Pool,id:string){return withRun(pool,id,async run=>{run.state='closed';run.closedAt=(await now(pool)).toISOString();await save(pool,run);return run;});}
export function scheduledIdentity(request:Request,body:{invocation_id?:string;trigger?:{id?:string;type?:string};data?:{scheduled_at?:string}}){
  const invocationId=request.headers.get('x-neon-trigger-invocation-id');const scheduledAt=new Date(body.data?.scheduled_at??'');
  requireValidation(invocationId&&body.invocation_id===invocationId&&body.trigger?.id===TRIGGER&&body.trigger.type==='schedule'&&Number.isFinite(+scheduledAt));return {invocationId,scheduledAt:scheduledAt.toISOString()};
}
export async function tick(db:Database,pool:Pool,binding:ValidationBinding,occurrence:{invocationId:string;scheduledAt:string}){
  return withRun(pool,binding.runId,async run=>{
    const time=await now(pool);
    if(!binding.enabled||run.state!=='armed'||time>=new Date(run.expiresAt)||run.admitted>=2)return {outcome:'disarmed',run};
    if(new Date(occurrence.scheduledAt)<new Date(run.endsAt))return {outcome:'waiting',run};
    if(run.occurrences.some(o=>o.invocationId===occurrence.invocationId||o.scheduledAt===occurrence.scheduledAt))return {outcome:'duplicate',run};
    let stage='admission';
    try{
      const permit=authorizeScheduledPermit({...run,createdAt:new Date(run.createdAt),expiresAt:new Date(run.expiresAt),endsAt:new Date(run.endsAt)},binding,time,new Date(occurrence.scheduledAt));
      if(run.occurrences.length)requireValidation(Math.floor(Date.parse(occurrence.scheduledAt)/60000)>Math.floor(Date.parse(run.occurrences.at(-1)!.scheduledAt)/60000));
      const store=await auditStore();requireValidation(store.fingerprint===ACTIVE_KEY);const before=await financialSnapshot(pool);requireValidation(digest(before)===(run.admitted===0?run.preparedHash:run.settledHash));verifyFixture(before,run,run.admitted===1);
      // Durable fail-closed claim. If this process dies, 'executing' does not
      // admit another scheduled invocation, even after redeploy.
      run.state='executing';run.admitted++;const entry={...occurrence,outcome:'executing'};run.occurrences.push(entry);await save(pool,run);
      stage='scoped-worker';let failures=0;await processDue(db,()=>{failures++;},permit);requireValidation(failures===0);
      stage='verification';const after=await financialSnapshot(pool);const evidence=verifyFixture(after,run,true);
      const report=await auditReport(db,run.auctionId);requireValidation(report.status==='INTEGRO'&&report.checkpoints.length===3&&report.signatureKeys?.every(k=>k.fingerprint===ACTIVE_KEY));await verifyHistorical(db);
      if(run.admitted===2)requireValidation(digest(after)===run.settledHash);
      run.settledHash=digest(after);run.receiptId=evidence.receiptId!;entry.outcome=run.admitted===1?'settled':'idempotent';run.state=run.admitted===2?'complete':'armed';await save(pool,run);
      return {outcome:entry.outcome,run,evidence};
    }catch{run.state='failed';run.failure=stage;await save(pool,run);return {outcome:'failed',run};}
  });
}
export async function status(pool:Pool,id:string){return withRun(pool,id,async run=>{
  const snapshot=await financialSnapshot(pool);let evidence:ReturnType<typeof verifyFixture>|undefined;
  let verificationFailed=false;
  if(run.auctionId&&run.depositId)try{evidence=verifyFixture(snapshot,run,Boolean(run.receiptId));}catch{verificationFailed=true;}
  return {run,evidence,verificationFailed,maintenance:true,jobs:false,binding:configuredBinding(),configurationSafe:configurationSafe()};
});}

