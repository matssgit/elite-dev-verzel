/* global process,console,setTimeout */
import https from 'node:https';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
if(!process.argv.includes('--authorized-anonymous-transport-only'))throw Error('Anonymous transport-only diagnostic authorization required');
const base='https://br-muddy-mud-b80fr83g-settlement.compute.c-14.us-east-1.aws.neon.tech';
const runId=randomUUID(),agent=new https.Agent({keepAlive:true,maxSockets:1}),socketIds=new WeakMap();let nextId=0,sourceChanged=false,pumping=true;
const result={runId,startedAt:new Date().toISOString(),anonymousOnly:true,sessionsCreated:0,financialOperationsExecuted:false,requests:[],deployments:[],cleanup:{}};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const save=()=>writeFile('tmp/post-403-connection.json',JSON.stringify(result,null,2));
async function request(label,{fresh=false,method='GET'}={}){return new Promise((resolve,reject)=>{
  const path=method==='GET'?'/scheduled-validation/status':'/scheduled-validation/preflight';let connectionId;
  const req=https.request(base+path+'?transport='+randomUUID(),{method,agent:fresh?false:agent,headers:{'cache-control':'no-cache',...(fresh?{connection:'close'}:{})}},res=>{
    res.resume();res.on('end',async()=>{const row={at:new Date().toISOString(),label,method,status:res.statusCode,connectionMode:fresh?'fresh-close':'persistent',connectionId,reusedSocket:req.reusedSocket,diagnosticId:res.headers['x-elite-diagnostic-id']??null,authorizationSent:false,cookieSent:false};result.requests.push(row);await save();resolve(row);});
  });req.on('socket',socket=>{if(!socketIds.has(socket))socketIds.set(socket,++nextId);connectionId=socketIds.get(socket);});req.setTimeout(20000,()=>req.destroy(Error('Anonymous transport probe timeout')));req.on('error',()=>reject(Error('Anonymous transport probe failed')));req.end();
});}
async function cli(config,env={}){
  const ack=await new Promise((resolve,reject)=>{let out='';const child=spawn('npx.cmd',['--yes','neon@latest','deploy','--config',config,'--update-existing','--no-env-pull','--output','json','--project-id','cold-haze-51518470','--branch','production','--profile','elite-verzel'],{shell:true,env:{...process.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',s=>out+=s);child.stderr.on('data',()=>{});child.on('error',()=>reject(Error('CLI start failed')));child.on('exit',code=>{if(code!==0)return reject(Error('CLI update failed; output withheld'));try{resolve(JSON.parse(out));}catch{reject(Error('Invalid CLI acknowledgement'));}});});
  if(ack.branchId!=='br-muddy-mud-b80fr83g'||ack.dryRun!==false||ack.conflicts.length||!ack.applied.filter(c=>c.action!=='noop').every(c=>c.kind==='service'&&c.details?.slug==='settlement'))throw Error('Unexpected deployment result');
  result.deployments.push({at:new Date().toISOString(),config,branch:ack.branchName,slug:'settlement'});await save();
}
let pump;
try{
  const baseline=await request('baseline-normal');if(baseline.status!==405)throw Error('Normal-source baseline not established');
  // Keep the SAME authenticated-free TCP connection alive during the deploy.
  pump=(async()=>{while(pumping){const row=await request('keep-alive-during-deploy');if(![403,405].includes(row.status))throw Error('Unexpected anonymous access');await pause(700);}})().catch(()=>{result.failure='Anonymous connection pump failed';pumping=false;});
  sourceChanged=true;await cli('deploy/neon-post-diagnostic.ts',{SCHEDULED_VALIDATION_RUN_ID:runId,SCHEDULED_VALIDATION_SESSION_HASH:'0'.repeat(64),SCHEDULED_DIAGNOSTIC_UNTIL:new Date(Date.now()+600000).toISOString()});
  if(result.failure)throw Error(result.failure);
  let current=false;for(let n=0;n<12;n++){const row=await request('fresh-generation-observation-'+n,{fresh:true});if(row.status===403&&row.diagnosticId===runId){current=true;break;}if(![403,405].includes(row.status))throw Error('Unexpected anonymous permission');await pause(5000);}if(!current)throw Error('Fresh diagnostic generation not observed');
  for(let i=0;i<4;i++){
    const old=await request('paired-persistent-'+i),fresh=await request('paired-fresh-'+i,{fresh:true}),post=await request('paired-fresh-post-'+i,{fresh:true,method:'POST'});
    if(![403,405].includes(old.status)||fresh.status!==403||post.status!==403||fresh.diagnosticId!==runId||post.diagnosticId!==runId)throw Error('Unexpected anonymous permission/generation result');
    console.log(JSON.stringify({event:'anonymous-pair',i,persistentStatus:old.status,persistentConnectionId:old.connectionId,persistentDiagnosticId:old.diagnosticId,freshStatus:fresh.status,freshDiagnosticId:fresh.diagnosticId,freshPostDiagnosticId:post.diagnosticId}));await pause(1000);
  }
  result.completed=true;
}catch(error){result.failure=error.message;console.log(JSON.stringify({event:'transport-stopped',reason:error.message}));}
finally{
  pumping=false;if(pump)await pump.catch(()=>{});agent.destroy();
  if(sourceChanged)try{await cli('deploy/neon-audit-persistence.ts');result.cleanup.normalSourceAcknowledged=true;}catch{result.cleanup.normalSourceAcknowledged=false;}
  for(let i=0;i<12;i++){try{const row=await request('final-normal',{fresh:true});if(row.status===405){result.cleanup.normalSourceObserved=true;break;}}catch{/* Bounded anonymous GET only. */}await pause(5000);}
  result.finishedAt=new Date().toISOString();await save();
}
console.log(JSON.stringify({event:'transport-finished',completed:result.completed,cleanup:result.cleanup,evidence:'tmp/post-403-connection.json'}));
if(!result.completed||!result.cleanup.normalSourceObserved)process.exitCode=1;
