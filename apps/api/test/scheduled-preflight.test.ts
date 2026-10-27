import { it,expect,vi,afterEach } from 'vitest';
const state=vi.hoisted(()=>({authorized:true,ended:0,financialCalls:0}));
vi.mock('../src/db/client.js',()=>({connect:()=>({db:{},pool:{end:async()=>{state.ended++;}}})}));
vi.mock('../src/settlement/scheduled-validation.js',()=>({
  configurationSafe:()=>true,configuredBinding:()=>({runId:'public-run',enabled:false}),operatorAuthorized:async()=>state.authorized,
  prepare:async()=>{state.financialCalls++;throw Error('Must not prepare');},
  arm:async()=>{throw Error('Must not arm');},close:async()=>{throw Error('Must not close');},status:async()=>{throw Error('Must not query control table');},tick:async()=>{throw Error('Must not tick');},scheduledIdentity:()=>{throw Error('Must not admit');},
}));
import handler from '../src/settlement/scheduled-function.js';
afterEach(()=>{state.authorized=true;state.ended=0;state.financialCalls=0;});
it('authenticated POST preflight has no setup, control-table, financial or scheduler effects',async()=>{
  const response=await handler.fetch(new Request('https://function.test/scheduled-validation/preflight',{method:'POST'}));
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({nonFinancial:true,configurationSafe:true,maintenance:true,jobs:false,binding:{runId:'public-run',enabled:false}});expect(response.headers.get('cache-control')).toBe('no-store');expect(state.financialCalls).toBe(0);expect(state.ended).toBe(1);
});
it('unauthorized POST preflight stays forbidden and cannot prepare anything',async()=>{
  state.authorized=false;const response=await handler.fetch(new Request('https://function.test/scheduled-validation/preflight',{method:'POST'}));expect(response.status).toBe(403);expect(state.financialCalls).toBe(0);expect(state.ended).toBe(1);
});
