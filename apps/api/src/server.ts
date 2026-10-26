import { env } from './config.js';
import { buildApp } from './app.js';
const app = await buildApp({databaseUrl:env.DATABASE_URL,webOrigin:env.WEB_ORIGIN,logger:true,runJobs:process.env.RUN_SETTLEMENT_JOBS!=='false'});
for(const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>{void app.close().then(()=>process.exit(0));});
await app.listen({host:env.HOST,port:env.PORT});
