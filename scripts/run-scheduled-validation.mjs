/* global fetch, AbortSignal, process, console, setTimeout, URL */
import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile,writeFile } from 'node:fs/promises';
import { verifyReport } from './audit-verification.mjs';

// Operator-authorized, ONE RUN ONLY. No retry of fixture preparation/finance.
// Demo app session stays in memory; only its one-way hash goes to Neon config.
if(!process.argv.includes('--execute-authorized-plan'))throw Error('Explicit authorized-plan execution flag required; do not retry after a failed run without operator authorization');
const api='https://elite-dev-verzel-api.onrender.com',web='https://elite-dev-verzel-zmats-projects.vercel.app';
const fn='https://br-muddy-mud-b80fr83g-settlement.compute.c-14.us-east-1.aws.neon.tech';
const trigger='trigger-81af7a75-3b54-4914-ad70-d410cfb95939';
const active='07e8ccdec02da616cf480e19a0599271679ed625376bf8968837502b0af94ab2',manifest='126e42c16b21a5b7e3256c507e96eead53bb0a956e94f741928b04505c0e25a1',root='dc3370282c6119b2a77433fc95c0c84fa6868b23f77e8d6ffd7027d872f3ece3';
const baseline=JSON.parse(await readFile('tmp/audit-final-reports-after-redeploy.json','utf8'));
const ids=Object.keys(baseline),runId=randomUUID(),output='tmp/scheduled-settlement-result.json';
const result={format:'elite-scheduled-validation/v1',runId,startedAt:new Date().toISOString(),demonstrationOnly:true,realMoneyMoved:false,maintenance:true,events:[],cleanup:{},success:false};
let token,temporarySource=false,prepareAttempted=false,cronMayBeEnabled=false;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const record=async(event,data)=>{result.events.push({at:new Date().toISOString(),event,...data});await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify({event,...data}));};
async function cli(args,env={}){
  return new Promise((resolve,reject)=>{
    let stdout='';const child=spawn('npx.cmd',['--yes','neon@latest',...args,'--project-id','cold-haze-51518470','--branch','production','--profile','elite-verzel'],{shell:true,env:{...process.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',s=>{stdout+=s;});child.stderr.on('data',()=>{});
    child.on('error',()=>reject(Error('Neon CLI could not start')));child.on('exit',code=>code===0?resolve(stdout):reject(Error(`Neon CLI failed (${code}); no private output emitted`)));
    // Do not surface provider config or arbitrary logs. Inspect only parsed,
    // explicitly selected non-secret fields from successful structured output.
  });
}
async function json(url,init={}){
  const response=await fetch(url,{...init,signal:AbortSignal.timeout(60000)});assert.equal(response.status,200,`Unexpected HTTP ${response.status} at ${new URL(url).pathname}`);return response.json();
}
const headers=()=>({authorization:`Bearer ${token}`});
async function control(path,method='GET'){return json(fn+'/scheduled-validation/'+path,{method,headers:headers()});}
async function ready(predicate){
  for(let i=0;i<12;i++){try{const state=await control('status');if(predicate(state))return state;}catch{/* Read-only cold-start polling only. */}await pause(5000);}
  throw Error('Bounded read-only function readiness timed out');
}
async function maintenance(){
  for(const path of ['/wallet/deposits','/auctions','/auctions/00000000-0000-4000-8000-000000000100/bids','/auctions/00000000-0000-4000-8000-000000000100/cancel']){
    const response=await fetch(api+path,{method:'POST',headers:{origin:web,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(60000)});assert.equal(response.status,503);assert.equal((await response.json()).code,'MAINTENANCE');
  }
}
async function oldHistories(){
  let count=0;for(const id of ids){const report=await json(api+'/audit/'+id);assert.equal(report.status,'INTEGRO');assert.equal(report.fingerprint,active);verifyReport(report,root,manifest);assert.deepEqual(report.records,baseline[id].records);assert.deepEqual(report.checkpoints,baseline[id].checkpoints);count+=report.checkpoints.length;}
  assert.equal(count,15);return count;
}
async function applyConfig(config,env={}){
  // Updating an existing function is explicitly authorized. A successful CLI
  // exit alone does not attest that the selected source actually was applied.
  const ack=JSON.parse(await cli(['deploy','--config',config,'--update-existing','--no-env-pull','--output','json'],env));
  assert.equal(ack.branchId,'br-muddy-mud-b80fr83g');assert.equal(ack.branchName,'production');assert.equal(ack.dryRun,false);assert.equal(ack.conflicts.length,0);
  const changes=ack.applied.filter(change=>change.action!=='noop');
  assert.ok(changes.some(change=>change.kind==='service'&&change.action==='update'&&change.details?.slug==='settlement'));
  assert.ok(changes.every(change=>change.kind==='service'&&change.details?.slug==='settlement'));
  await record('deployment-confirmed',{config,branch:ack.branchName,slug:'settlement',action:'update'});
}
async function deploy(env){await applyConfig('deploy/neon-scheduled-validation.ts',env);}
try{
  assert.equal(ids.length,5);await maintenance();await oldHistories();
  // This diagnostic belongs to the Neon function, not the normal Render API.
  const check=await json(fn+'/rotation-readiness');assert.equal(check.ok,true);assert.equal(check.maintenance,true);assert.equal(check.fingerprint,active);assert.equal(check.transitionHash,manifest);assert.equal(check.financialInvariants,true);assert.equal(check.financialSnapshotMatchesIncidentBaseline,true);
  assert.equal((await json(api+'/health')).status,'ok');
  const triggers=JSON.parse(await cli(['triggers','list','--output','json']));assert.equal(triggers.length,1);assert.equal(triggers[0].trigger_id,trigger);assert.equal(triggers[0].enabled,false);
  const session=await json(api+'/auth/login',{method:'POST',headers:{origin:web,'content-type':'application/json'},body:JSON.stringify({email:'leiloeiro@demo.local',password:'DemoVerzel2026!'})});token=session.token;assert.match(token,/^[a-f0-9]{64}$/);
  const env={SCHEDULED_VALIDATION_RUN_ID:runId,SCHEDULED_VALIDATION_SESSION_HASH:createHash('sha256').update(token).digest('hex'),SCHEDULED_VALIDATION_ENABLED:'false'};
  temporarySource=true;await deploy(env);await ready(s=>s.prepared===false&&s.configurationSafe===true&&s.binding.runId===runId&&s.binding.enabled===false);
  assert.equal((await fetch(fn+'/scheduled-validation/status',{signal:AbortSignal.timeout(60000)})).status,403);
  await record('preflight',{historicalCheckpoints:15,publicFinancialRoutesBlocked:true,cronEnabled:false,activeFingerprint:active,manifestHash:manifest});
  prepareAttempted=true;
  const run=await control('prepare','POST');assert.equal(run.state,'prepared');assert.equal(run.amountCents,1000);assert.equal(run.admitted,0);
  result.fixture={auctionId:run.auctionId,buyerId:run.buyerId,sellerId:run.sellerId,depositId:run.depositId,createdAt:run.createdAt,endsAt:run.endsAt,expiresAt:run.expiresAt,baselineHash:run.baselineHash,preparedHash:run.preparedHash};
  await record('fixture-prepared',result.fixture);
  Object.assign(env,{SCHEDULED_VALIDATION_AUCTION_ID:run.auctionId,SCHEDULED_VALIDATION_BUYER_ID:run.buyerId,SCHEDULED_VALIDATION_SELLER_ID:run.sellerId});
  await deploy(env);await ready(s=>s.run?.state==='prepared'&&s.binding.auctionId===run.auctionId&&!s.binding.enabled&&!s.verificationFailed);
  await oldHistories();await maintenance();const prepared=await control('status');assert.equal(prepared.evidence.buyer.totalCents,10000);assert.equal(prepared.evidence.buyer.committedCents,1000);assert.equal(prepared.evidence.seller.totalCents,0);
  await control('arm','POST');env.SCHEDULED_VALIDATION_ENABLED='true';await deploy(env);await ready(s=>s.run?.state==='armed'&&s.binding.enabled&&s.binding.auctionId===run.auctionId&&!s.verificationFailed);
  // Keep enough time for two genuine minute occurrences plus observation.
  assert.ok(Date.now()<Date.parse(run.expiresAt)-180000);
  cronMayBeEnabled=true;await cli(['triggers','update',trigger,'--enabled','true']);await record('cron-enabled',{trigger,endsAt:run.endsAt,expiresAt:run.expiresAt});
  let previous='',complete;
  while(Date.now()<Date.parse(run.expiresAt)){
    const state=await control('status');const marker=state.run.state+':'+state.run.admitted;
    if(marker!==previous){await record('observed-state',{state:state.run.state,admitted:state.run.admitted,evidence:state.evidence,occurrences:state.run.occurrences});previous=marker;}
    if(state.run.state==='failed'||state.verificationFailed)throw Error('Run failed; no financial retry authorized');
    if(state.run.state==='complete'){complete=state;break;}
    await pause(10000);
  }
  assert.ok(complete,'No two completed scheduled occurrences within the fixed window');assert.equal(complete.run.admitted,2);assert.deepEqual(complete.run.occurrences.map(o=>o.outcome),['settled','idempotent']);assert.equal(complete.evidence.financialHash,complete.run.settledHash);
  result.settlement=complete;result.success=true;
}catch(error){result.failure=error.message;console.log(JSON.stringify({event:'stopped',reason:error.message}));}
finally{
  // Persistently close BEFORE disabling: queued provider events must no-op.
  if(prepareAttempted){try{const closed=await control('close','POST');result.cleanup.runClosed=closed.state==='closed';result.closedRun=closed;}catch{result.cleanup.runClosed=false;result.success=false;}}
  if(cronMayBeEnabled){try{await cli(['triggers','update',trigger,'--enabled','false']);result.cleanup.cronPaused=true;}catch{result.cleanup.cronPaused=false;result.success=false;}}
  else result.cleanup.cronPaused=true;
  if(temporarySource){try{await applyConfig('deploy/neon-audit-persistence.ts');result.cleanup.temporarySourceRemoved=true;}catch{result.cleanup.temporarySourceRemoved=false;result.success=false;}}
  if(token){try{const response=await fetch(api+'/auth/logout',{method:'POST',headers:{authorization:`Bearer ${token}`,origin:web},signal:AbortSignal.timeout(60000)});result.cleanup.sessionRevoked=response.status===204;}catch{result.cleanup.sessionRevoked=false;}token=undefined;}
  await writeFile(output,JSON.stringify(result,null,2));
}
// All post-test checks are read-only. No settlement retry is permitted here.
try{
  await maintenance();result.finalHistoricalCheckpoints=await oldHistories();
  const triggers=JSON.parse(await cli(['triggers','list','--output','json']));assert.equal(triggers[0].enabled,false);assert.equal(triggers[0].next_run_at,null);result.finalTrigger=triggers[0];
  const check=await json(fn+'/rotation-readiness');assert.equal(check.ok,true);assert.equal(check.financialInvariants,true);assert.equal(check.maintenance,true);assert.equal(check.fingerprint,active);result.functionReadiness=check;
  result.apiHealth=await json(api+'/health');assert.equal(result.apiHealth.status,'ok');
  const removed=await fetch(fn+'/scheduled-validation/status',{signal:AbortSignal.timeout(60000)});assert.equal(removed.status,405);result.cleanup.temporarySourceUnavailable=true;
  if(result.settlement){
    const run=result.settlement.run,report=await json(api+'/audit/'+run.auctionId);verifyReport(report,root,manifest);assert.equal(report.status,'INTEGRO');assert.equal(report.records.length,3);assert.equal(report.checkpoints.length,3);assert.ok(report.signatureKeys.every(k=>k.fingerprint===active));result.newAudit=report;
    const receipt=await json(api+'/receipts/'+run.receiptId);assert.equal(receipt.amountCents,1000);assert.equal(receipt.verification,'INTEGRO');assert.equal(receipt.signingFingerprint,active);result.receipt=receipt;
    const page=await fetch(web+'/comprovantes/'+run.receiptId,{signal:AbortSignal.timeout(60000)});assert.equal(page.status,200);result.receiptPageStatus=page.status;
    const logs=JSON.parse(await cli(['logs','query','--source','function','--scope-name','neon.function.app','--body-contains',runId,'--since','30m','--limit','100','--output','json']));
    // This query only matches our run UUID, emitted with safe metadata by the handler.
    result.providerLogs=logs;
    const rendered=JSON.stringify(logs);for(const occurrence of run.occurrences){assert.ok(rendered.includes(occurrence.invocationId));assert.ok(rendered.includes(occurrence.scheduledAt));assert.ok(rendered.includes(occurrence.outcome));}
  }
  result.finalMaintenance=true;result.publicFinancialRoutesBlocked=true;
}catch(error){result.success=false;result.finalVerificationFailure=error.message;}
result.finishedAt=new Date().toISOString();await writeFile(output,JSON.stringify(result,null,2));
console.log(JSON.stringify({success:result.success,failure:result.failure,finalVerificationFailure:result.finalVerificationFailure,cleanup:result.cleanup,auctionId:result.fixture?.auctionId,evidence:output}));
if(!result.success)process.exitCode=1;
