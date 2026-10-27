import { createHash } from 'node:crypto';
import prepared from './scheduled-function.js';
import normal from './function.js';
import { FUNCTION_BUILD_ID,versioned } from './function-provenance.js';

// Diagnostic-only envelope around the unchanged 4153e21 authorization and POST
// preflight. No route can reach prepare/arm/close/tick, even with a valid token.
export default {async fetch(request:Request):Promise<Response>{
  const path=new URL(request.url).pathname;
  if(request.method==='GET'&&path==='/rotation-readiness')return normal.fetch(request);
  const allowed=(path==='/scheduled-validation/preflight'&&request.method==='POST')||(path==='/scheduled-validation/status'&&request.method==='GET');
  if(!allowed)return versioned(new Response('Not found',{status:404}));
  const deadline=Date.parse(process.env.SCHEDULED_DIAGNOSTIC_UNTIL??'');
  if(!Number.isFinite(deadline)||Date.now()>=deadline)return versioned(new Response('Diagnostic expired',{status:404}));
  if(process.env.FINANCIAL_MAINTENANCE!=='true'||process.env.SCHEDULED_VALIDATION_ENABLED!=='false'||['AUCTION_ID','BUYER_ID','SELLER_ID'].some(k=>Boolean(process.env[`SCHEDULED_VALIDATION_${k}`])))return versioned(new Response('Diagnostic containment rejected',{status:503}));
  const response=await prepared.fetch(request);
  // Public generation marker distinguishes application responses from stale
  // deployments/platform rejection. No credential/hash/cookie value is exposed.
  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store');headers.set('x-elite-diagnostic-id',process.env.SCHEDULED_VALIDATION_RUN_ID??'');
  headers.set('x-elite-diagnostic-build',FUNCTION_BUILD_ID);
  const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')??'')?.[1];
  headers.set('x-elite-diagnostic-bearer-match',String(Boolean(token&&createHash('sha256').update(token).digest('hex')===process.env.SCHEDULED_VALIDATION_SESSION_HASH)));
  return versioned(new Response(response.body,{status:response.status,headers}));
}};
