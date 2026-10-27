import normal from './function.js';
import { connect } from '../db/client.js';
import { arm,close,configurationSafe,configuredBinding,operatorAuthorized,prepare,scheduledIdentity,status,tick } from './scheduled-validation.js';

// Temporary source, removed after the test. Financial configuration never
// comes from an HTTP body; the root accepts only actual provider occurrences.
export default {async fetch(request:Request):Promise<Response>{
  const path=new URL(request.url).pathname;
  if(!path.startsWith('/scheduled-validation')&&!(path==='/'&&request.method==='POST'))return normal.fetch(request);
  if(!configurationSafe())return Response.json({ok:false,stage:'configuration',maintenance:true},{status:503});
  const {db,pool}=connect(process.env.DATABASE_URL_UNPOOLED??process.env.DATABASE_URL!);
  try{
    const binding=configuredBinding();
    if(path==='/'){const occurrence=scheduledIdentity(request,await request.json());const result=await tick(db,pool,binding,occurrence);console.log(JSON.stringify({job:'scheduled-validation',runId:binding.runId,...occurrence,outcome:result.outcome,admitted:result.run.admitted}));return Response.json({ok:result.outcome!=='failed',outcome:result.outcome},{status:result.outcome==='failed'?503:200});}
    if(!await operatorAuthorized(db,request))return new Response('Forbidden',{status:403});
    if(path==='/scheduled-validation/preflight'&&request.method==='POST')return Response.json({ok:true,nonFinancial:true,binding,configurationSafe:true,maintenance:true,jobs:false},{headers:{'cache-control':'no-store'}});
    if(path==='/scheduled-validation/status'&&request.method==='GET'){
      // Readiness before fixture creation must not implicitly create a run.
      const exists=await pool.query("SELECT to_regclass('scheduled_validation_runs') AS name");
      if(!exists.rows[0]?.name||!(await pool.query('SELECT 1 FROM scheduled_validation_runs WHERE id=$1',[binding.runId])).rowCount)return Response.json({ok:true,prepared:false,binding,configurationSafe:true,maintenance:true,jobs:false});
      return Response.json(await status(pool,binding.runId));
    }
    if(request.method!=='POST')return new Response('Method not allowed',{status:405});
    if(path==='/scheduled-validation/prepare'&&!binding.enabled)return Response.json(await prepare(db,pool,binding.runId));
    if(path==='/scheduled-validation/arm')return Response.json(await arm(pool,binding));
    if(path==='/scheduled-validation/close')return Response.json(await close(pool,binding.runId));
    return new Response('Not found',{status:404});
  }catch{return Response.json({ok:false,stage:'contained-validation',maintenance:true},{status:503});}
  finally{await pool.end();}
}};
