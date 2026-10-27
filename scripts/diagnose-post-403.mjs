/* global fetch,AbortSignal,process,console,setTimeout,URL */
import { createHash,randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile,writeFile } from 'node:fs/promises';
import { verifyReport,verifyTransition,verifySigningProof } from './audit-verification.mjs';
if(!process.argv.includes('--authorized-neutral-only'))throw Error('Explicit neutral-only authorization required');
const api='https://elite-dev-verzel-api.onrender.com',web='https://elite-dev-verzel-zmats-projects.vercel.app',fn='https://br-muddy-mud-b80fr83g-settlement.compute.c-14.us-east-1.aws.neon.tech';
const root='dc3370282c6119b2a77433fc95c0c84fa6868b23f77e8d6ffd7027d872f3ece3',pin='126e42c16b21a5b7e3256c507e96eead53bb0a956e94f741928b04505c0e25a1';
const runId=randomUUID(),output='tmp/post-403-diagnostic.json';
const evidence={format:'elite-neutral-post-diagnostic/v1',runId,startedAt:new Date().toISOString(),requests:[],deployments:[],cleanup:{},financialOperationsExecuted:false,fixtureOrSettlementRouteCalled:false,blockedMaintenanceProbesOnly:true,cronEnabled:false};
let token,sourceChanged=false,stage='preflight';
const check=(value,label)=>{if(!value)throw Error(label);};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const save=()=>writeFile(output,JSON.stringify(evidence,null,2));
async function cli(args,env={}){return new Promise((resolve,reject)=>{
  let out='';const child=spawn('npx.cmd',['--yes','neon@latest',...args,'--project-id','cold-haze-51518470','--branch','production','--profile','elite-verzel'],{shell:true,env:{...process.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',s=>{out+=s;});child.stderr.on('data',()=>{});child.on('error',()=>reject(Error('Native CLI start failed')));child.on('exit',code=>code===0?resolve(out):reject(Error('Native CLI failed; output withheld')));
});}
async function apply(config,env={}){
  const ack=JSON.parse(await cli(['deploy','--config',config,'--update-existing','--no-env-pull','--output','json'],env));
  check(ack.branchId==='br-muddy-mud-b80fr83g'&&ack.branchName==='production'&&ack.dryRun===false&&ack.conflicts.length===0,'Unexpected deployment target/result');
  const changes=ack.applied.filter(c=>c.action!=='noop');check(changes.length>0&&changes.every(c=>c.kind==='service'&&c.details?.slug==='settlement'),'Unexpected deployment scope');
  const row={at:new Date().toISOString(),config,branch:ack.branchName,slug:'settlement',action:'update'};evidence.deployments.push(row);await save();console.log(JSON.stringify({event:'deployed',...row}));
}
async function json(url,init={}){const r=await fetch(url,{...init,redirect:'manual',signal:AbortSignal.timeout(60000)});check(r.status===200,'Unexpected baseline response');return r.json();}
async function integrity(){
  const baseline=JSON.parse(await readFile('tmp/audit-final-reports-after-redeploy.json','utf8'));let checkpoints=0;
  for(const [id,prior]of Object.entries(baseline)){const report=await json(api+'/audit/'+id);verifyReport(report,root,pin);check(report.status==='INTEGRO'&&JSON.stringify(report.records)===JSON.stringify(prior.records)&&JSON.stringify(report.checkpoints)===JSON.stringify(prior.checkpoints),'Historical integrity failure');checkpoints+=report.checkpoints.length;}
  check(checkpoints===15,'Unexpected checkpoint count');const ready=await json(fn+'/rotation-readiness');
  check(ready.ok&&ready.maintenance&&ready.financialInvariants&&ready.financialSnapshotMatchesIncidentBaseline&&ready.existingSigningProofVerified&&ready.existingTransitionArtifactsVerified,'Financial/signing integrity failure');verifySigningProof(ready.signingProof,verifyTransition(ready.transition,root,pin));
  return {checkedAt:new Date().toISOString(),checkpoints,historicalRecordsAndSignaturesUnchanged:true,financialSnapshotUnchanged:true,ready};
}
async function containment(){
  const results=[];for(const path of ['/wallet/deposits','/auctions','/auctions/00000000-0000-4000-8000-000000000100/bids','/auctions/00000000-0000-4000-8000-000000000100/cancel']){
    const r=await fetch(api+path,{method:'POST',headers:{origin:web,'content-type':'application/json'},body:'{}',redirect:'manual',signal:AbortSignal.timeout(60000)});check(r.status===503&&(await r.json()).code==='MAINTENANCE','Public financial containment failure');results.push({path,status:503});
  }return results;
}
async function triggers(){const rows=JSON.parse(await cli(['triggers','list','--output','json']));check(rows.length===1&&rows[0].trigger_id==='trigger-81af7a75-3b54-4914-ad70-d410cfb95939'&&rows[0].enabled===false&&rows[0].next_run_at===null,'Cron containment failure');return rows[0];}
// Only these two nonfinancial routes can be contacted on the diagnostic source.
async function probe(label,{method='POST',path='/scheduled-validation/preflight',auth=true,invalid=false,cookie=false,origin,body,contentType,csrf=false}={}){
  const headers={'cache-control':'no-cache'};
  if(auth)headers.authorization='Bearer '+(invalid?'0'.repeat(64):token);
  if(cookie)headers.cookie='diagnostic=neutral'; // fabricated, never an auth/session cookie
  if(origin)headers.origin=origin;if(contentType)headers['content-type']=contentType;if(csrf)headers['x-csrf-token']='neutral-probe';
  const started=Date.now(),r=await fetch(fn+path+'?probe='+randomUUID(),{method,headers,body,redirect:'manual',signal:AbortSignal.timeout(20000)});
  const text=await r.text();let data;try{data=JSON.parse(text);}catch{/* Never persist arbitrary provider bodies. */}
  const location=r.headers.get('location');let redirectTarget=null;if(location){const u=new URL(location,r.url);redirectTarget=u.origin+u.pathname;}
  const row={at:new Date().toISOString(),label,method,status:r.status,elapsedMs:Date.now()-started,authorizationSent:auth,invalidBearer:invalid,cookieMode:cookie?'fabricated-nonauth-cookie':'none',origin:origin??null,contentTypeSent:contentType??null,bodyMode:body===undefined?'absent':'empty-json',csrfProbeHeader:csrf,
    diagnosticId:r.headers.get('x-elite-diagnostic-id'),diagnosticBuild:r.headers.get('x-elite-diagnostic-build'),bearerMatch:r.headers.get('x-elite-diagnostic-bearer-match'),responseContentType:r.headers.get('content-type'),cacheControl:r.headers.get('cache-control'),allowOrigin:r.headers.get('access-control-allow-origin'),allowHeaders:r.headers.get('access-control-allow-headers'),setCookiePresent:r.headers.has('set-cookie'),redirected:r.redirected,redirectTarget,
    body:{ok:data?.ok===true,nonFinancial:data?.nonFinancial===true,configurationSafe:data?.configurationSafe===true,runMatches:data?.binding?.runId===runId,modeDisabled:data?.binding?.enabled===false,maintenance:data?.maintenance===true,jobsDisabled:data?.jobs===false,knownText:['Forbidden','Not found','Method not allowed'].includes(text)?text:null,length:text.length},responseHeaderNames:[...r.headers.keys()]};
  evidence.requests.push(row);await save();console.log(JSON.stringify({event:'probe',label,status:row.status,diagnosticId:row.diagnosticId,bearerMatch:row.bearerMatch,redirectTarget:row.redirectTarget}));return row;
}
function current(row){return row.diagnosticId===runId&&row.diagnosticBuild==='neutral-v1';}
function denied(row){return [401,403,404,405,503].includes(row.status);}
try{
  evidence.before=await integrity();evidence.beforeBlocks=await containment();evidence.beforeTrigger=await triggers();
  stage='single-session';const login=await fetch(api+'/auth/login',{method:'POST',headers:{origin:web,'content-type':'application/json'},body:JSON.stringify({email:'leiloeiro@demo.local',password:'DemoVerzel2026!'}),redirect:'manual',signal:AbortSignal.timeout(60000)});
  check(login.status===200,'Diagnostic session could not be created');const session=await login.json();token=session.token;
  check(typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)&&session.user?.role==='LEILOEIRO','Unexpected diagnostic session format/role');
  evidence.session={created:true,account:'existing demo operator required by unchanged authorization',effectiveFunctionRoutes:['GET /scheduled-validation/status','POST /scheduled-validation/preflight'],rawCredentialStored:false,loginSetCookiePresent:login.headers.has('set-cookie')};
  stage='diagnostic-source';sourceChanged=true;const until=new Date(Date.now()+600000).toISOString();evidence.diagnosticDeadline=until;
  await apply('deploy/neon-post-diagnostic.ts',{SCHEDULED_VALIDATION_RUN_ID:runId,SCHEDULED_VALIDATION_SESSION_HASH:createHash('sha256').update(token).digest('hex'),SCHEDULED_DIAGNOSTIC_UNTIL:until});
  stage='propagation-observation';let visible=false;
  for(let n=0;n<12;n++){
    const get=await probe('observation-get-'+n,{method:'GET',path:'/scheduled-validation/status'});
    const post=await probe('observation-post-'+n);
    if(current(get)&&get.status===200){check(get.body.configurationSafe&&get.body.runMatches&&get.body.modeDisabled&&get.body.maintenance&&get.body.jobsDisabled,'Diagnostic configuration integrity failure');}
    if(current(post)&&post.status===200)check(post.body.nonFinancial&&post.body.configurationSafe&&post.body.modeDisabled,'Neutral endpoint integrity failure');
    if(current(get)&&current(post)){visible=true;break;}
    await wait(5000);
  }
  check(visible,'Diagnostic generation not observed within bounded window');
  stage='negative-authorization';
  for(const [label,options]of [['anonymous',{auth:false}],['wrong-bearer',{invalid:true}],['cookie-only',{auth:false,cookie:true}],['cross-origin-no-bearer',{auth:false,origin:'https://example.invalid',body:'{}',contentType:'application/json'}]]){
    const row=await probe(label,options);check(denied(row),'SECURITY FAILURE: unauthenticated request accepted');
  }
  stage='authenticated-matrix';
  for(const [label,options]of [['bearer-bodyless',{}],['bearer-json',{body:'{}',contentType:'application/json'}],['bearer-web-origin',{origin:web,body:'{}',contentType:'application/json'}],['bearer-other-origin',{origin:'https://example.invalid',body:'{}',contentType:'application/json'}],['bearer-fake-cookie',{cookie:true,body:'{}',contentType:'application/json'}],['bearer-csrf-header',{csrf:true,body:'{}',contentType:'application/json'}],['cors-options',{method:'OPTIONS',auth:false,origin:web}]]){
    const row=await probe(label,options);if(row.status===200)check(current(row)&&row.body.nonFinancial&&row.body.configurationSafe,'Unexpected accepted response');
  }
  stage='stability';await wait(10000);
  await probe('stable-get',{method:'GET',path:'/scheduled-validation/status'});await probe('stable-post');
  evidence.diagnosticCompleted=true;
}catch(error){evidence.failure={stage,reason:error.message};console.log(JSON.stringify({event:'stopped',stage,reason:error.message}));}
finally{
  // Revoke the only session before removing the source. Never create a second
  // session to work around a rejection; no operation or cron retry exists here.
  if(token){try{const r=await fetch(api+'/auth/logout',{method:'POST',headers:{authorization:'Bearer '+token,origin:web},redirect:'manual',signal:AbortSignal.timeout(60000)});evidence.cleanup.sessionRevoked=r.status===204;if(r.status===204&&sourceChanged){const row=await probe('revoked-session');evidence.cleanup.revokedSessionDenied=denied(row);}}catch{evidence.cleanup.sessionRevoked=false;}token=undefined;}
  if(sourceChanged){try{await apply('deploy/neon-audit-persistence.ts');evidence.cleanup.normalSourceAcknowledged=true;}catch{evidence.cleanup.normalSourceAcknowledged=false;}}
  if(sourceChanged){for(let i=0;i<12;i++){try{const r=await fetch(fn+'/scheduled-validation/status?removed='+randomUUID(),{headers:{'cache-control':'no-cache'},redirect:'manual',signal:AbortSignal.timeout(20000)});if(r.status===405){evidence.cleanup.normalSourceObserved=true;break;}}catch{/* Bounded read-only observation. */}await wait(5000);}}
  await save();
}
try{
  evidence.after=await integrity();evidence.afterBlocks=await containment();evidence.afterTrigger=await triggers();evidence.apiHealth=await json(api+'/health');
  evidence.success=Boolean(evidence.diagnosticCompleted&&!evidence.failure&&evidence.cleanup.sessionRevoked&&evidence.cleanup.revokedSessionDenied&&evidence.cleanup.normalSourceObserved);
}catch(error){evidence.finalFailure=error.message;evidence.success=false;}
evidence.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify({event:'finished',success:evidence.success,cleanup:evidence.cleanup,evidence:output}));
if(!evidence.success)process.exitCode=1;
