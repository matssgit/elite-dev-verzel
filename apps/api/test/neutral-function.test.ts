import { createHash } from 'node:crypto';
import { it,expect,vi,afterEach } from 'vitest';
const calls=vi.hoisted(()=>({prepared:vi.fn(async()=>Response.json({ok:true,nonFinancial:true})),normal:vi.fn(async()=>Response.json({ok:true}))}));
vi.mock('../src/settlement/scheduled-function.js',()=>({default:{fetch:calls.prepared}}));
vi.mock('../src/settlement/function.js',()=>({default:{fetch:calls.normal}}));
import handler from '../src/settlement/neutral-function.js';
function setup(){for(const [key,value]of Object.entries({FINANCIAL_MAINTENANCE:'true',SCHEDULED_VALIDATION_ENABLED:'false',SCHEDULED_DIAGNOSTIC_UNTIL:new Date(Date.now()+600000).toISOString(),SCHEDULED_VALIDATION_RUN_ID:'public-run',SCHEDULED_VALIDATION_AUCTION_ID:'',SCHEDULED_VALIDATION_BUYER_ID:'',SCHEDULED_VALIDATION_SELLER_ID:'',SCHEDULED_VALIDATION_SESSION_HASH:createHash('sha256').update('a'.repeat(64)).digest('hex')}))vi.stubEnv(key,value);}
afterEach(()=>{vi.unstubAllEnvs();calls.prepared.mockClear();calls.normal.mockClear();});
it('never dispatches financial controls or scheduler, even with an authenticated bearer',async()=>{
  setup();for(const path of ['/','/scheduled-validation/prepare','/scheduled-validation/arm','/scheduled-validation/close','/wallet/deposits'])expect((await handler.fetch(new Request('https://local.test'+path,{method:'POST',headers:{authorization:'Bearer '+'a'.repeat(64)}}))).status).toBe(404);
  expect(calls.prepared).not.toHaveBeenCalled();expect(calls.normal).not.toHaveBeenCalled();
});
it('only adds nonsecret provenance to the original neutral handler response',async()=>{
  setup();const response=await handler.fetch(new Request('https://local.test/scheduled-validation/preflight',{method:'POST',headers:{authorization:'Bearer '+'a'.repeat(64)}}));expect(response.status).toBe(200);expect(response.headers.get('x-elite-diagnostic-id')).toBe('public-run');expect(response.headers.get('x-elite-diagnostic-bearer-match')).toBe('true');expect(response.headers.get('cache-control')).toBe('no-store');expect(calls.prepared).toHaveBeenCalledTimes(1);expect(JSON.stringify([...response.headers])).not.toContain('a'.repeat(64));
});
it('rejects expiry, disabled maintenance and any fixture binding before reaching the handler',async()=>{
  for(const [key,value]of [['SCHEDULED_DIAGNOSTIC_UNTIL','2000-01-01'],['FINANCIAL_MAINTENANCE','false'],['SCHEDULED_VALIDATION_ENABLED','true'],['SCHEDULED_VALIDATION_BUYER_ID','bound-user']]){
    setup();vi.stubEnv(key!,value!);const response=await handler.fetch(new Request('https://local.test/scheduled-validation/preflight',{method:'POST'}));expect([404,503]).toContain(response.status);
  }expect(calls.prepared).not.toHaveBeenCalled();
});
