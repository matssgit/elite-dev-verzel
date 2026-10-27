/* global fetch, AbortSignal, process, console */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Only public demo-account credentials are used here. The ephemeral session
// stays in memory, never in a file, child environment, command line or output.
const api='https://elite-dev-verzel-api.onrender.com';
const web='https://elite-dev-verzel-zmats-projects.vercel.app';
const fn='https://br-muddy-mud-b80fr83g-settlement.compute.c-14.us-east-1.aws.neon.tech';
const target='00000000-0000-4000-8000-000000000100';
const ids=['8e1b798d-0654-4f4e-b514-933f4d4b7bf7','87f4ae5d-aab5-49e7-83f2-77bd2ba4fd39','c2eaa536-a502-4dfa-9f2b-1511b082bba3','30ae384d-0b99-4430-8dca-131f51e7bd41',target];
async function json(url,init={}) {
  const response=await fetch(url,{...init,signal:AbortSignal.timeout(120000)});
  const body=await response.json();assert.equal(response.status,200,`HTTP ${response.status}: ${JSON.stringify(body)}`);return body;
}
async function deploy(config,env) {
  await new Promise((resolve,reject)=>{
    const child=spawn('npx.cmd',['--yes','neon@latest','deploy','--config',config,'--project-id','cold-haze-51518470','--branch','production','--profile','elite-verzel','--no-env-pull'],{shell:true,env:{...process.env,...env},stdio:['ignore','inherit','inherit'],windowsHide:true});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Deployment exited ${code}`)));
  });
}
async function maintenance() {
  for(const path of ['/wallet/deposits','/auctions',`/auctions/${target}/bids`,`/auctions/${target}/cancel`]) {
    const response=await fetch(api+path,{method:'POST',headers:{origin:web,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(60000)});
    assert.equal(response.status,503);assert.equal((await response.json()).code,'MAINTENANCE');
  }
}
let token,armed=false;
try {
  await maintenance();
  const before={};for(const id of ids){before[id]=await json(`${api}/audit/${id}`);assert.equal(before[id].status,'INTEGRO');}
  assert.equal(before[target].records.length,2);
  const session=await json(api+'/auth/login',{method:'POST',headers:{'content-type':'application/json',origin:web},body:JSON.stringify({email:'leiloeiro@demo.local',password:'DemoVerzel2026!'})});token=session.token;assert.ok(token);
  const sessionHash=createHash('sha256').update(token).digest('hex');
  console.log('Preflight passed: maintenance, five old histories, dedicated demo session. Arming only the fixed R$50 lot.');
  armed=true;
  await deploy('deploy/neon-controlled-demo.ts',{CONTROLLED_DEMO_SESSION_HASH:sessionHash,CONTROLLED_DEMO_UNTIL:new Date(Date.now()+15*60000).toISOString()});
  const forbidden=await fetch(fn+'/controlled-demo-settlement',{method:'POST'});assert.equal(forbidden.status,403);
  // Deliberately no HTTP retry: an uncertain response must be inspected read-only.
  const result=await json(fn+'/controlled-demo-settlement',{method:'POST',headers:{authorization:`Bearer ${token}`}});
  await writeFile('tmp/controlled-demo-settlement-result.json',JSON.stringify({checkedAt:new Date().toISOString(),...result},null,2));
  assert.equal(result.ok,true);assert.equal(result.demonstrationOnly,true);assert.equal(result.realMoneyMoved,false);assert.equal(result.idempotent,true);assert.equal(result.unexpectedFinancialChanges,false);
  const after={};for(const id of ids){after[id]=await json(`${api}/audit/${id}`);assert.equal(after[id].status,'INTEGRO');if(id!==target)assert.deepEqual(after[id],before[id]);}
  assert.deepEqual(after[target].records.slice(0,2),before[target].records);assert.deepEqual(after[target].checkpoints.slice(0,2),before[target].checkpoints);
  assert.equal(after[target].records.length,3);assert.equal(after[target].checkpoints.length,3);
  const receipt=await json(api+'/receipts/'+result.receiptId);assert.equal(receipt.amountCents,5000);assert.equal(receipt.verification,'INTEGRO');
  const page=await fetch(web+'/comprovantes/'+result.receiptId);assert.equal(page.status,200);
  await maintenance();
  await writeFile('tmp/controlled-demo-audits-after.json',JSON.stringify(after,null,2));
  await writeFile('tmp/controlled-demo-public-checks.json',JSON.stringify({checkedAt:new Date().toISOString(),fiveAuditsIntact:true,oldCheckpointsPreserved:14,totalCheckpoints:15,receiptApiStatus:200,receiptPageStatus:page.status,receiptId:result.receiptId,amountCents:receipt.amountCents,maintenance:true,financialMutationsBlocked:true},null,2));
  console.log(JSON.stringify(result));
}finally {
  try {if(armed)await deploy('deploy/neon-maintenance.ts',{FINANCIAL_MAINTENANCE:'true'});}
  finally {if(token){const logout=await fetch(api+'/auth/logout',{method:'POST',headers:{authorization:`Bearer ${token}`,origin:web}});token=undefined;assert.equal(logout.status,204);console.log('Dedicated application session revoked.');}}
  if(armed){const unavailable=await fetch(fn+'/controlled-demo-settlement');assert.ok([404,405].includes(unavailable.status));console.log('Temporary execution source removed; maintenance remains true. Cron was not changed.');}
}
