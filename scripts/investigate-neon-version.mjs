/* global process,console,fetch,AbortSignal,setTimeout */
import https from 'node:https';
import { createHash,randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile,writeFile } from 'node:fs/promises';
import { canonical,verifyReport,verifyTransition,verifySigningProof } from './audit-verification.mjs';
import { classifyFunctionResponse } from './function-version-verification.mjs';
import { deploymentMetadata,waitForActiveDeployment } from './neon-deployment-verification.mjs';
if(!process.argv.includes('--authorized-technical-only'))throw Error('Technical-only authorization required');
const api='https://elite-dev-verzel-api.onrender.com',web='https://elite-dev-verzel-zmats-projects.vercel.app',fn='https://br-muddy-mud-b80fr83g-settlement.compute.c-14.us-east-1.aws.neon.tech';
const root='dc3370282c6119b2a77433fc95c0c84fa6868b23f77e8d6ffd7027d872f3ece3',pin='126e42c16b21a5b7e3256c507e96eead53bb0a956e94f741928b04505c0e25a1';
const buildId=/FUNCTION_BUILD_ID='([a-f0-9]{64})'/.exec(await readFile('apps/api/src/settlement/function-build.ts','utf8'))?.[1];if(!buildId)throw Error('Missing immutable build');
const runId=randomUUID(),expected={buildId,runId},agent=new https.Agent({keepAlive:true,maxSockets:1}),sockets=new WeakMap();let nextSocket=0,token,changed=false,pumping=false,pump,stage='baseline';
const evidence={format:'elite-neon-version-investigation/v1',runId,buildId,startedAt:new Date().toISOString(),requests:[],deployments:[],metadata:[],cleanup:{},financialOperationsExecuted:false,financialControlRoutesCalled:false,sessionsCreated:0,cronEverEnabled:false};
const save=()=>writeFile('tmp/neon-version-investigation.json',JSON.stringify(evidence,null,2));
const check=(ok,message)=>{if(!ok)throw Error(message);};const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function cli(args,env={}){return new Promise((resolve,reject)=>{
  let out='';const c=spawn('npx.cmd',['--yes','neon@latest',...args,'--project-id','cold-haze-51518470','--branch','production','--profile','elite-verzel'],{shell:true,env:{...process.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});
  c.stdout.on('data',s=>out+=s);c.stderr.on('data',()=>{});c.on('error',()=>reject(Error('CLI start failed')));c.on('exit',code=>code===0?resolve(out):reject(Error('CLI failed; arbitrary output withheld')));
});}
async function list(){return JSON.parse(await cli(['functions','list','--output','json']));}
async function apply(config,env={}){
  const previous=deploymentMetadata(await list());
  const ack=JSON.parse(await cli(['deploy','--config',config,'--update-existing','--no-env-pull','--output','json'],env));
  check(ack.branchId==='br-muddy-mud-b80fr83g'&&!ack.dryRun&&!ack.conflicts.length,'Deployment target mismatch');const changes=ack.applied.filter(c=>c.action!=='noop');check(changes.length&&changes.every(c=>c.kind==='service'&&c.details?.slug==='settlement'),'Unexpected deployment scope');
  const step={at:new Date().toISOString(),config,previous};evidence.deployments.push(step);await save();console.log(JSON.stringify({event:'configuration-acknowledged',config,previousCurrent:previous.current.id}));return previous;
}
async function active(previous,config){return waitForActiveDeployment(list,{previousId:previous.current.id,url:fn+'/',observe:async m=>{
  const row={at:new Date().toISOString(),config,...m};evidence.metadata.push(row);await save();console.log(JSON.stringify({event:'deployment-state',config,current:m.current?.id,currentStatus:m.current?.status,active:m.active?.id,activeStatus:m.active?.status}));
}});}
async function json(url,init={}){const r=await fetch(url,{...init,redirect:'manual',signal:AbortSignal.timeout(60000)});check(r.status===200,'Baseline HTTP check failed');return r.json();}
async function integrity(){
  const baseline=JSON.parse(await readFile('tmp/audit-final-reports-after-redeploy.json','utf8'));let count=0;
  for(const [id,prior]of Object.entries(baseline)){const r=await json(api+'/audit/'+id);verifyReport(r,root,pin);check(r.status==='INTEGRO'&&canonical(r.records)===canonical(prior.records)&&canonical(r.checkpoints)===canonical(prior.checkpoints),'Historical integrity failure');count+=r.checkpoints.length;}
  const r=await json(fn+'/rotation-readiness');check(count===15&&r.ok&&r.maintenance&&r.financialInvariants&&r.financialSnapshotMatchesIncidentBaseline&&r.existingSigningProofVerified&&r.existingTransitionArtifactsVerified,'Financial/signing integrity failure');verifySigningProof(r.signingProof,verifyTransition(r.transition,root,pin));
  return {at:new Date().toISOString(),checkpoints:count,recordsAndSignaturesUnchanged:true,snapshotUnchanged:true,readiness:r};
}
async function blocks(){const rows=[];for(const path of ['/wallet/deposits','/auctions','/auctions/00000000-0000-4000-8000-000000000100/bids','/auctions/00000000-0000-4000-8000-000000000100/cancel']){const r=await fetch(api+path,{method:'POST',headers:{origin:web,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(60000)});check(r.status===503&&(await r.json()).code==='MAINTENANCE','Public financial block failed');rows.push({path,status:503});}return rows;}
async function trigger(){const rows=JSON.parse(await cli(['triggers','list','--output','json']));check(rows.length===1&&rows[0].trigger_id==='trigger-81af7a75-3b54-4914-ad70-d410cfb95939'&&!rows[0].enabled&&rows[0].next_run_at===null,'Cron not paused');return rows[0];}
async function request(label,{method='GET',transport='fresh',auth=true,wrong=false,phase='sample',bodyless=false,expect=expected}={}){
  const path=method==='GET'?'/scheduled-validation/status':'/scheduled-validation/preflight',body=method==='POST'&&!bodyless?'{}':undefined;
  const headers={'cache-control':'no-cache','user-agent':'elite-version-probe/v2'};if(auth)headers.authorization='Bearer '+(wrong?'0'.repeat(64):token);if(body){headers['content-type']='application/json';headers['content-length']='2';}
  let status,text,hs,socketId=null,reusedSocket=null;
  if(transport==='fetch'){
    const r=await fetch(fn+path+'?versionProbe='+randomUUID(),{method,headers,body,redirect:'manual',signal:AbortSignal.timeout(20000)});status=r.status;text=await r.text();hs=r.headers;
  }else{
    const r=await new Promise((resolve,reject)=>{
      const c=https.request(fn+path+'?versionProbe='+randomUUID(),{method,headers:{...headers,...(transport==='fresh'?{connection:'close'}:{})},agent:transport==='fresh'?false:agent},r=>{let data='';r.on('data',chunk=>{if(data.length<65536)data+=chunk;});r.on('end',()=>resolve({status:r.statusCode,text:data,headers:r.headers,reused:c.reusedSocket}));});
      c.on('socket',s=>{if(!sockets.has(s))sockets.set(s,++nextSocket);socketId=sockets.get(s);});c.setTimeout(20000,()=>c.destroy(Error('Neutral request timeout')));c.on('error',()=>reject(Error('Neutral transport failed')));c.end(body);
    });status=r.status;text=r.text;hs={get:key=>r.headers[key]??null};reusedSocket=r.reused;
  }
  let data;try{data=JSON.parse(text);}catch{/* Preserve no arbitrary bodies or credential headers. */}
  const row={at:new Date().toISOString(),label,phase,method,transport,status,socketId,reusedSocket,authorizationSent:auth,wrongBearer:wrong,buildId:hs.get('x-elite-build-id'),runId:hs.get('x-elite-run-id'),protocol:hs.get('x-elite-version-protocol'),version:data?.version,nonFinancial:data?.nonFinancial===true,configurationSafe:data?.configurationSafe===true,maintenance:data?.maintenance===true,jobsDisabled:data?.jobs===false,modeDisabled:data?.binding?.enabled===false,setCookiePresent:Boolean(hs.get('set-cookie')),redirect:Boolean(hs.get('location'))};
  row.classification=classifyFunctionResponse(row,expect);evidence.requests.push(row);await save();
  if(row.classification==='INCONSISTENT_PROVENANCE')throw Error('SECURITY: contradictory build provenance');
  if(!auth||wrong)check(status!==200,'SECURITY: invalid/missing bearer accepted');
  if(row.classification==='CURRENT_ACCEPTED')check(row.configurationSafe&&row.maintenance&&row.jobsDisabled&&row.modeDisabled&&(method==='GET'||row.nonFinancial),'SECURITY: diagnostic containment mismatch');
  return row;
}
try{
  evidence.before=await integrity();evidence.beforeBlocks=await blocks();evidence.beforeTrigger=await trigger();evidence.initialMetadata=deploymentMetadata(await list());
  stage='single-session';const login=await json(api+'/auth/login',{method:'POST',headers:{origin:web,'content-type':'application/json'},body:JSON.stringify({email:'leiloeiro@demo.local',password:'DemoVerzel2026!'})});token=login.token;check(typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)&&login.user.role==='LEILOEIRO','Unexpected diagnostic session');evidence.sessionsCreated=1;
  await request('predeploy-persistent',{transport:'persistent',phase:'before'});await request('predeploy-fetch',{transport:'fetch',phase:'before'});
  pumping=true;pump=(async()=>{while(pumping){await request('persistent-transition',{transport:'persistent',phase:'transition'});await pause(2000);}})().catch(()=>{evidence.pumpFailure=true;pumping=false;});
  stage='deploy';changed=true;const deadline=new Date(Date.now()+600000).toISOString();evidence.diagnosticDeadline=deadline;
  const previous=await apply('deploy/neon-post-diagnostic.ts',{SCHEDULED_VALIDATION_RUN_ID:runId,SCHEDULED_VALIDATION_SESSION_HASH:createHash('sha256').update(token).digest('hex'),SCHEDULED_DIAGNOSTIC_UNTIL:deadline});
  await request('after-ack-get',{phase:'after-ack'});await request('after-ack-post',{method:'POST',phase:'after-ack'});
  stage='wait-active';evidence.target=await active(previous,'diagnostic');pumping=false;await pump;check(!evidence.pumpFailure,'Transition probe failed');
  stage='consistency';evidence.consistencyStartedAt=new Date().toISOString();
  for(let round=0;round<12;round++){
    for(const transport of ['persistent','fresh','fetch'])for(const method of ['GET','POST'])await request(`round-${round}`,{transport,method,phase:'after-active'});
    console.log(JSON.stringify({event:'neutral-round',round,samples:evidence.requests.filter(r=>r.phase==='after-active').length}));await pause(2000);
  }
  stage='negative-auth';for(const transport of ['fresh','fetch']){await request('anonymous',{transport,auth:false,method:'POST',phase:'negative'});await request('wrong-bearer',{transport,wrong:true,method:'POST',phase:'negative'});}
  await request('bodyless-fresh',{method:'POST',bodyless:true,phase:'after-active'});await request('bodyless-fetch',{method:'POST',bodyless:true,transport:'fetch',phase:'after-active'});
  evidence.afterSampleMetadata=deploymentMetadata(await list());check(evidence.afterSampleMetadata.active?.id===evidence.target.active.id&&evidence.afterSampleMetadata.current?.id===evidence.target.current.id,'Concurrent active revision change');
  const positives=evidence.requests.filter(r=>r.phase==='after-active');const negatives=evidence.requests.filter(r=>r.phase==='negative');
  evidence.consistency={samples:positives.length,accepted:positives.filter(r=>r.classification==='CURRENT_ACCEPTED').length,unexpected:positives.filter(r=>r.classification==='UNEXPECTED_VERSION').length,authRejected:positives.filter(r=>r.classification==='AUTH_REJECTED').length,negativeSamples:negatives.length,negativeVerified:negatives.filter(r=>r.classification==='AUTH_REJECTED').length,startedAt:evidence.consistencyStartedAt,finishedAt:new Date().toISOString()};
  evidence.consistent=positives.every(r=>r.classification==='CURRENT_ACCEPTED')&&negatives.every(r=>r.classification==='AUTH_REJECTED');
}catch(error){evidence.failure={stage,reason:error.message};console.log(JSON.stringify({event:'technical-stopped',...evidence.failure}));}
finally{
  pumping=false;if(pump)await pump.catch(()=>{});agent.destroy();
  if(token){try{const r=await fetch(api+'/auth/logout',{method:'POST',headers:{origin:web,authorization:'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(60000)});evidence.cleanup.sessionRevoked=r.status===204;if(r.status===204&&changed){const row=await request('revoked-session',{method:'POST',phase:'revoked'});evidence.cleanup.revokedByExpectedVersion=row.classification==='AUTH_REJECTED';}}catch{evidence.cleanup.sessionRevoked=false;}token=undefined;}
  if(changed){try{
    const previous=await apply('deploy/neon-audit-persistence.ts');evidence.restoredTarget=await active(previous,'normal');evidence.cleanup.normalCompletedAndActive=true;
    const row=await request('normal-restored',{auth:false,phase:'restored',expect:{buildId,runId:''}});evidence.cleanup.normalVersionVerified=row.status===405&&row.buildId===buildId&&row.runId==='';
  }catch{evidence.cleanup.normalCompletedAndActive=false;}}
  await save();
}
try{evidence.after=await integrity();evidence.afterBlocks=await blocks();evidence.afterTrigger=await trigger();evidence.health=await json(api+'/health');}catch(error){evidence.finalFailure=error.message;}
evidence.financialTrialRemainsBlocked=true;evidence.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify({event:'finished',consistent:evidence.consistent,consistency:evidence.consistency,cleanup:evidence.cleanup,failure:evidence.failure,finalFailure:evidence.finalFailure,evidence:'tmp/neon-version-investigation.json'}));
if(evidence.failure||evidence.finalFailure||!evidence.cleanup.normalCompletedAndActive||!evidence.cleanup.normalVersionVerified||!evidence.cleanup.sessionRevoked)process.exitCode=1;
