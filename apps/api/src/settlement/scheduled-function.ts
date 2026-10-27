import normal from './function.js';
import { connect } from '../db/client.js';
import { arm,close,configurationSafe,configuredBinding,operatorAuthorized,prepare,scheduledIdentity,status,tick } from './scheduled-validation.js';
import { financialVersionMatches,functionVersion,versioned } from './function-provenance.js';
import { AppError } from '../errors.js';

// Temporary source, removed after the test. Financial configuration never
// comes from an HTTP body; the root accepts only actual provider occurrences.
export default {async fetch(request:Request):Promise<Response>{
  const path=new URL(request.url).pathname;
  if(!path.startsWith('/scheduled-validation')&&!(path==='/'&&request.method==='POST'))return normal.fetch(request);
  if(request.method==='POST'&&(path==='/'||path==='/scheduled-validation/prepare'||path==='/scheduled-validation/arm')&&!financialVersionMatches(request,path==='/'))return versioned(Response.json({ok:false,code:'FUNCTION_VERSION_MISMATCH',version:functionVersion()},{status:409}));
  if(!configurationSafe())return versioned(Response.json({ok:false,stage:'configuration',maintenance:true,version:functionVersion()},{status:503}));
  const {db,pool}=connect(process.env.DATABASE_URL_UNPOOLED??process.env.DATABASE_URL!);
  try{
    const binding=configuredBinding();
    if(path==='/'){const occurrence=scheduledIdentity(request,await request.json());const result=await tick(db,pool,binding,occurrence);console.log(JSON.stringify({job:'scheduled-validation',runId:binding.runId,...occurrence,outcome:result.outcome,admitted:result.run.admitted}));return versioned(Response.json({ok:result.outcome!=='failed',outcome:result.outcome,version:functionVersion()},{status:result.outcome==='failed'?503:200}));}
    if(!await operatorAuthorized(db,request))return versioned(new Response('Forbidden',{status:403}));
    if(path==='/scheduled-validation/preflight'&&request.method==='POST')return versioned(Response.json({ok:true,nonFinancial:true,binding,configurationSafe:true,maintenance:true,jobs:false,version:functionVersion()}));
    if(path==='/scheduled-validation/status'&&request.method==='GET'){
      // Readiness before fixture creation must not implicitly create a run.
      const exists=await pool.query("SELECT to_regclass('scheduled_validation_runs') AS name");
      if(!exists.rows[0]?.name||!(await pool.query('SELECT 1 FROM scheduled_validation_runs WHERE id=$1',[binding.runId])).rowCount)return versioned(Response.json({ok:true,prepared:false,binding,configurationSafe:true,maintenance:true,jobs:false,version:functionVersion()}));
      return versioned(Response.json({...await status(pool,binding.runId),version:functionVersion()}));
    }
    if(request.method!=='POST')return new Response('Method not allowed',{status:405});
    if(path==='/scheduled-validation/prepare'&&!binding.enabled)return versioned(Response.json({...await prepare(db,pool,binding.runId),version:functionVersion()}));
    if(path==='/scheduled-validation/arm')return versioned(Response.json({...await arm(pool,binding),version:functionVersion()}));
    if(path==='/scheduled-validation/close')return versioned(Response.json({...await close(pool,binding.runId),version:functionVersion()}));
    return new Response('Not found',{status:404});
  }catch(error){if(error instanceof AppError&&[401,403].includes(error.statusCode))return versioned(Response.json({ok:false,code:error.code,version:functionVersion()},{status:error.statusCode}));return versioned(Response.json({ok:false,stage:'contained-validation',maintenance:true,version:functionVersion()},{status:503}));}
  finally{await pool.end();}
}};
