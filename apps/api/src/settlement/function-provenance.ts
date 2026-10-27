import { FUNCTION_BUILD_ID } from './function-build.js';
export { FUNCTION_BUILD_ID };
export const functionVersion=()=>({protocol:'elite-function/v2',buildId:FUNCTION_BUILD_ID,runId:process.env.SCHEDULED_VALIDATION_RUN_ID??''});
export function versioned(response:Response){
  const version=functionVersion(),headers=new Headers(response.headers);
  headers.set('cache-control','no-store');headers.set('vary','Authorization');
  headers.set('x-elite-build-id',version.buildId);headers.set('x-elite-run-id',version.runId);headers.set('x-elite-version-protocol',version.protocol);
  return new Response(response.body,{status:response.status,headers});
}
// A version header never authenticates a caller. These checks run BEFORE a DB
// connection/financial service; existing authorization remains mandatory later.
export function financialVersionMatches(request:Request,scheduled=false){
  const version=functionVersion();
  return process.env.SCHEDULED_VALIDATION_EXPECTED_BUILD===version.buildId&&Boolean(version.runId)&&
    (scheduled||(request.headers.get('x-elite-expected-build')===version.buildId&&request.headers.get('x-elite-expected-run')===version.runId));
}
