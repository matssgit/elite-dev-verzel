import { afterEach,it,expect,vi } from 'vitest';
import { financialVersionMatches,FUNCTION_BUILD_ID,versioned } from '../src/settlement/function-provenance.js';
import { classifyFunctionResponse } from '../../../scripts/function-version-verification.mjs';
afterEach(()=>vi.unstubAllEnvs());
it('distinguishes authentication denial from wrong generation BEFORE inspecting status',()=>{
  const expected={buildId:'build',runId:'run'},version={...expected,protocol:'elite-function/v2'};
  expect(classifyFunctionResponse({status:403,buildId:'old',runId:'run',protocol:version.protocol},expected)).toBe('UNEXPECTED_VERSION');
  expect(classifyFunctionResponse({status:403,...version},expected)).toBe('AUTH_REJECTED');
  expect(classifyFunctionResponse({status:200,...version,version},expected)).toBe('CURRENT_ACCEPTED');
  expect(classifyFunctionResponse({status:200,...version,version:{...version,runId:'other'}},expected)).toBe('INCONSISTENT_PROVENANCE');
  expect(classifyFunctionResponse({status:200,...version},expected)).toBe('INCONSISTENT_PROVENANCE');
});
it('refuses missing/different client generation and deployment pin before financial admission',()=>{
  const req=new Request('https://test/',{headers:{'x-elite-expected-build':FUNCTION_BUILD_ID,'x-elite-expected-run':'public-run'}});
  expect(financialVersionMatches(req)).toBe(false);vi.stubEnv('SCHEDULED_VALIDATION_RUN_ID','public-run');vi.stubEnv('SCHEDULED_VALIDATION_EXPECTED_BUILD',FUNCTION_BUILD_ID);
  expect(financialVersionMatches(req)).toBe(true);expect(financialVersionMatches(new Request('https://test/'))).toBe(false);
  expect(financialVersionMatches(new Request('https://test/'),true)).toBe(true);vi.stubEnv('SCHEDULED_VALIDATION_EXPECTED_BUILD','old');expect(financialVersionMatches(req,true)).toBe(false);
});
it('adds immutable build and deployment run to negative responses without credentials',()=>{
  vi.stubEnv('SCHEDULED_VALIDATION_RUN_ID','public-run');const response=versioned(new Response('Forbidden',{status:403}));expect(response.status).toBe(403);expect(response.headers.get('x-elite-build-id')).toBe(FUNCTION_BUILD_ID);expect(response.headers.get('x-elite-run-id')).toBe('public-run');expect(response.headers.get('cache-control')).toBe('no-store');
});
