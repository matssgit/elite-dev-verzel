import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { eq } from 'drizzle-orm';
import { z, ZodError } from 'zod';
import { loginSchema, registerSchema, depositSchema, createAuctionSchema, bidSchema } from '@elite/shared';
import { connect } from './db/client.js';
import { sessions } from './db/schema.js';
import { authenticate, register, login, tokenHash } from './auth/service.js';
import { deposit, getWallet, getEntries } from './wallet/service.js';
import { AppError } from './errors.js';
import { searchCatalog } from './catalog/service.js';
import { cancelAuction, createAuction, getRoom, listAuctions, placeBid, requireRole } from './auctions/service.js';
import { registerRealtime } from './auctions/realtime.js';
import { auditStore } from './audit/store.js';
import { auditReport, flushCheckpoints } from './audit/service.js';
import { getReceipt, myResults, processDue } from './settlement/service.js';
export async function buildApp(options: {databaseUrl:string;webOrigin:string;logger?:boolean;runJobs?:boolean}) {
  const app = Fastify({logger:options.logger ?? false,bodyLimit:16_384});
  const {db,pool} = connect(options.databaseUrl);
  async function anchor(id:string) {
    try{await flushCheckpoints(db,id);}catch(error){app.log.error({err:error},'Committed operation awaits independent checkpoint');throw new AppError(503,'CHECKPOINT_PENDING','Operação registrada; checkpoint pendente. Consulte o lote. Para repetir um lance, preserve a mesma chave de operação.');}
  }
  await app.register(cors,{origin:options.webOrigin,allowedHeaders:['Content-Type','Authorization','Idempotency-Key']});
  await app.register(helmet);
  await app.register(rateLimit,{max:120,timeWindow:'1 minute'});
  await app.register(websocket,{options:{maxPayload:1024}});
  await registerRealtime(app,options.databaseUrl,options.webOrigin);
  await auditStore();
  // A durable PostgreSQL scan runs at startup and periodically. No schedule is kept only in memory.
  if(options.runJobs) {
    let running:Promise<void>|undefined;let stopping=false;
    const tick=()=>{if(!stopping&&!running)running=processDue(db,error=>app.log.error({err:error},'Settlement/checkpoint job failed')).finally(()=>{running=undefined;});return running;};
    app.addHook('onReady',async()=>{await tick();});
    const timer=setInterval(()=>{void tick();},3000);timer.unref();
    app.addHook('preClose',async()=>{stopping=true;clearInterval(timer);await running;});
  }
  // Persist signed checkpoints outside the DB after commit; durable outbox retries on restart.
  app.addHook('onResponse',async()=>{await flushCheckpoints(db).catch(error=>app.log.error({err:error},'Checkpoint publication pending'));});
  app.addHook('onClose',async()=>{await pool.end();});
  app.setErrorHandler((error,request,reply)=>{
    if(error instanceof ZodError) return reply.code(400).send({code:'VALIDATION_ERROR',message:'Revise os campos informados.',issues:error.issues.map(i=>({path:i.path,message:i.message}))});
    if(error instanceof AppError) return reply.code(error.statusCode).send({code:error.code,message:error.message});
    if(error instanceof Error && 'statusCode' in error && typeof error.statusCode==='number' && error.statusCode < 500) return reply.code(error.statusCode).send({code:'REQUEST_ERROR',message:error.message});
    request.log.error({err:error},'request failed');
    return reply.code(500).send({code:'INTERNAL_ERROR',message:'Não foi possível concluir a operação.'});
  });
  app.get('/health',async()=>{await pool.query('SELECT 1'); return {status:'ok',serverTime:new Date().toISOString()};});
  const authLimit = {config:{rateLimit:{max:10,timeWindow:'1 minute'}}};
  app.post('/auth/register',authLimit,async(req,reply)=>reply.code(201).send({user:await register(db,registerSchema.parse(req.body))}));
  app.post('/auth/login',authLimit,async req=>{const input=loginSchema.parse(req.body);return login(db,input.email,input.password);});
  app.get('/auth/me',async req=>({user:await authenticate(db,req.headers.authorization)}));
  app.post('/auth/logout',async(req,reply)=>{
    await authenticate(db,req.headers.authorization);
    await db.delete(sessions).where(eq(sessions.tokenHash,tokenHash(req.headers.authorization!.slice(7))));
    return reply.code(204).send();
  });
  async function bidder(authorization?:string) {
    const user=await authenticate(db,authorization);
    if(user.role!=='LICITANTE') throw new AppError(403,'FORBIDDEN','Esta operação é exclusiva para licitantes.');
    return user;
  }
  app.get('/wallet',async req=>getWallet(db,(await bidder(req.headers.authorization)).id));
  app.get('/wallet/entries',async req=>({entries:await getEntries(db,(await bidder(req.headers.authorization)).id)}));
  app.post('/wallet/deposits',async req=>{
    const user=await bidder(req.headers.authorization);
    const input=depositSchema.parse(req.body);
    const key=z.uuid().parse(req.headers['idempotency-key']);
    return deposit(db,user.id,input.amountCents,key);
  });
  app.get('/catalog', {config:{rateLimit:{max:15,timeWindow:'1 minute'}}}, async req=>{
    const user=await authenticate(db,req.headers.authorization);requireRole(user,'LEILOEIRO');
    const {q}=z.object({q:z.string().trim().min(2).max(100)}).parse(req.query);
    return searchCatalog(db,q);
  });
  app.get('/auctions',async()=>listAuctions(db));
  app.get('/me/auctions',async req=>{
    const user=await authenticate(db,req.headers.authorization);requireRole(user,'LEILOEIRO');
    return listAuctions(db,user.id);
  });
  app.post('/auctions',async(req,reply)=>{
    const user=await authenticate(db,req.headers.authorization);
    const result=await createAuction(db,user,createAuctionSchema.parse(req.body));await anchor(result.id);
    return reply.code(201).send(result);
  });
  const auctionId=(params:unknown)=>z.object({id:z.uuid()}).parse(params).id;
  app.get('/me/results',async req=>myResults(db,await authenticate(db,req.headers.authorization)));
  app.get('/receipts/:id',async req=>getReceipt(db,auctionId(req.params)));
  app.get('/auctions/:id/receipt',async req=>{
    const {receipts}=await import('./db/schema.js');
    const [receipt]=await db.select({id:receipts.id}).from(receipts).where(eq(receipts.auctionId,auctionId(req.params)));
    return {receiptId:receipt?.id??null};
  });
  app.get('/audit/:id',async req=>auditReport(db,auctionId(req.params)));
  app.get('/auctions/:id',async req=>getRoom(db,auctionId(req.params)));
  app.post('/auctions/:id/cancel',async req=>{const result=await cancelAuction(db,await authenticate(db,req.headers.authorization),auctionId(req.params));await anchor(result.id);return result;});
  app.post('/auctions/:id/bids',async(req,reply)=>{
    const user=await authenticate(db,req.headers.authorization);
    const {amountCents}=bidSchema.parse(req.body);
    const key=z.uuid().parse(req.headers['idempotency-key']);
    const id=auctionId(req.params);const result=await placeBid(db,user,id,amountCents,key);await anchor(id);
    return reply.code(201).send(result);
  });
  return app;
}
