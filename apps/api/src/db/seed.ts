import { eq } from 'drizzle-orm';
import { env } from '../config.js';
import { connect } from './client.js';
import { users, auctions, catalogItems } from './schema.js';
import { register, publicUser } from '../auth/service.js';
import { deposit } from '../wallet/service.js';
import { searchCatalog } from '../catalog/service.js';
import { placeBid } from '../auctions/service.js';
import { openAudit, flushCheckpoints } from '../audit/service.js';
if(process.env.AUDIT_RECOVERY_MODE==='true'||process.env.FINANCIAL_MAINTENANCE==='true'){console.log('Maintenance/recovery: seed skipped, no financial writes.');process.exit(0);}
const {db,pool}=connect(env.DATABASE_URL);
if(env.NODE_ENV==='production' && process.env.ALLOW_DEMO_SEED!=='true') throw new Error('Use ALLOW_DEMO_SEED=true explicitamente no ambiente de demonstração.');
try {
  for(const [index,role] of ['LEILOEIRO','LICITANTE','LICITANTE'].entries()) {
    const email=['leiloeiro@demo.local','ana@demo.local','bruno@demo.local'][index]!;
    let [user]=await db.select().from(users).where(eq(users.email,email));
    if(!user) {
      await register(db,{name:['Marina Leilões','Ana','Bruno'][index]!,email,password:'DemoVerzel2026!',role:role as 'LEILOEIRO'|'LICITANTE'});
      [user]=await db.select().from(users).where(eq(users.email,email));
    }
    if(role==='LICITANTE' && user) await deposit(db,user.id,500_000,`00000000-0000-4000-8000-00000000000${index}`);
  }
  const [seller]=await db.select().from(users).where(eq(users.email,'leiloeiro@demo.local'));
  const [bidder]=await db.select().from(users).where(eq(users.email,'ana@demo.local'));
  let [source]=await db.select().from(catalogItems).where(eq(catalogItems.id,'OL1003040W'));
  if(!source) {
    const result=await searchCatalog(db,'Dom Casmurro');
    const selected=result.items.find(i=>i.id==='OL1003040W')??result.items[0];
    if(selected)source={id:selected.id,item:selected.item,importedAt:new Date(selected.item.importedAt)};
  }
  if(!source || !seller || !bidder)throw new Error('Não foi possível obter um item real para o lote de demonstração. Reexecute o seed quando o catálogo estiver disponível.');
  const id='00000000-0000-4000-8000-000000000100';
  await db.transaction(async tx=>{
    const [created]=await tx.insert(auctions).values({id,ownerId:seller.id,item:source.item,initialCents:5000,incrementCents:500,startsAt:new Date(Date.now()-300_000),endsAt:new Date(Date.now()+6*60*60_000)}).onConflictDoNothing().returning();
    if(created)await openAudit(tx,created);
  });
  const [lot]=await db.select().from(auctions).where(eq(auctions.id,id));
  if(lot && lot.bidCount===0 && !lot.cancelledAt && lot.endsAt>new Date())await placeBid(db,publicUser(bidder),id,5000,'00000000-0000-4000-8000-000000000101');
  await flushCheckpoints(db);
  console.log('Contas, carteiras e lote demo criados de forma idempotente. Lotes existentes não têm prazo/saldo reiniciados.');
} finally {await pool.end();}
