import { randomUUID,generateKeyPairSync,sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { beforeAll,afterAll,it,expect,vi } from 'vitest';
import pg from 'pg';
import { eq } from 'drizzle-orm';
const objects=vi.hoisted(()=>new Map<string,string>());
vi.mock('@vercel/blob',()=>({
  get:async(path:string)=>{const body=objects.get(path);return body===undefined?null:{statusCode:200,stream:new Response(body).body};},
  put:async(path:string,body:string,options:{allowOverwrite:boolean})=>{if(options.allowOverwrite||objects.has(path))throw Error('conflict');objects.set(path,body);},
  list:async({prefix}:{prefix:string})=>({blobs:[...objects.keys()].filter(k=>k.startsWith(prefix)).map(pathname=>({pathname})),hasMore:false}),
}));
import type { AuditTransition,ItemSnapshot } from '@elite/shared';
import { connect } from '../src/db/client.js';
import { auctions,bids,wallets } from '../src/db/schema.js';
import { register } from '../src/auth/service.js';
import { deposit } from '../src/wallet/service.js';
import { openAudit,appendAudit,flushCheckpoints,auditReport } from '../src/audit/service.js';
import { auditStore,digest } from '../src/audit/store.js';
import { publicFingerprint } from '../src/audit/crypto.js';
import { transitionUnsigned } from '../src/audit/rotation.js';
import { settleAuction,getReceipt } from '../src/settlement/service.js';
const source=process.env.TEST_DATABASE_URL;if(!source)throw Error('TEST_DATABASE_URL required');
const namespace=`rotation_${randomUUID().replaceAll('-','')}`,url=new URL(source);url.searchParams.set('options',`-c search_path=${namespace}`);
const admin=new pg.Pool({connectionString:source}),{db,pool}=connect(url.toString());
beforeAll(async()=>{await admin.query(`CREATE SCHEMA ${namespace}`);for(const path of ['0001_foundation.sql','0002_auctions.sql','0003_settlement_audit.sql'])await pool.query(await readFile(new URL(`../migrations/${path}`,import.meta.url),'utf8'));});
afterAll(async()=>{vi.unstubAllEnvs();await pool.end();await admin.query(`DROP SCHEMA ${namespace} CASCADE`);await admin.end();});
it('settles an old lot with a new key, preserves historical objects/receipt and fails closed on database rollback',async()=>{
  const old=generateKeyPairSync('ed25519'),next=generateKeyPairSync('ed25519');
  const oldPublic=old.publicKey.export({type:'spki',format:'pem'}).toString(),newPublic=next.publicKey.export({type:'spki',format:'pem'}).toString();
  const prefix=`db-${randomUUID()}/`;
  for(const [name,value]of Object.entries({AUDIT_STORAGE:'blob',AUDIT_BLOB_PREFIX:prefix,BLOB_READ_WRITE_TOKEN:'fixture',AUDIT_PRIVATE_KEY:old.privateKey.export({type:'pkcs8',format:'pem'}).toString(),AUDIT_PUBLIC_KEY_FINGERPRINT:publicFingerprint(oldPublic),AUDIT_TRANSITION_JSON:'',AUDIT_TRANSITION_SHA256:''}))vi.stubEnv(name,value);
  const seller=await register(db,{name:'Demo seller',email:`${randomUUID()}@rotation.test`,password:'TestPassword2026!',role:'LEILOEIRO'});
  const buyer=await register(db,{name:'Demo buyer',email:`${randomUUID()}@rotation.test`,password:'TestPassword2026!',role:'LICITANTE'});await deposit(db,buyer.id,10000,randomUUID());
  const item:ItemSnapshot={catalogId:'OL1003040W',title:'Demo',authors:[],firstPublishYear:null,image:null,sourceUrl:'https://openlibrary.org/works/OL1003040W',importedAt:new Date().toISOString()};
  const lot=await db.transaction(async tx=>{
    const endsAt=new Date(Date.now()-1000),[lot]=await tx.insert(auctions).values({ownerId:seller.id,item,initialCents:5000,incrementCents:100,leaderId:buyer.id,currentCents:5000,bidCount:1,startsAt:new Date(endsAt.getTime()-600000),endsAt}).returning();
    await openAudit(tx,lot!);const createdAt=new Date(endsAt.getTime()-200000);
    const [bid]=await tx.insert(bids).values({auctionId:lot!.id,bidderId:buyer.id,amountCents:5000,sequence:1,idempotencyKey:randomUUID(),createdAt}).returning();
    await tx.update(wallets).set({committedCents:5000}).where(eq(wallets.userId,buyer.id));
    await appendAudit(tx,lot!.id,{type:'BID',bidId:bid!.id,bidderPublicId:buyer.publicId,amountCents:5000,bidSequence:1,createdAt:createdAt.toISOString(),endsAt:endsAt.toISOString()});return lot!;
  });
  await flushCheckpoints(db);const prior=await auditReport(db,lot.id),originalObjects=new Map(objects);
  const manifest:AuditTransition={version:1,scope:'elite-audit-key-transition',id:randomUUID(),createdAt:new Date().toISOString(),namespace:prefix,legacyPublicKey:oldPublic,legacyFingerprint:publicFingerprint(oldPublic),legacyKeyStatus:'potentially-compromised',activePublicKey:newPublic,activeFingerprint:publicFingerprint(newPublic),boundaries:[{auctionId:lot.id,sequence:1,hash:prior.records[1]!.hash}],signature:''};
  manifest.signature=sign(null,Buffer.from(digest(transitionUnsigned(manifest)),'hex'),next.privateKey).toString('base64');
  vi.stubEnv('AUDIT_PRIVATE_KEY',next.privateKey.export({type:'pkcs8',format:'pem'}).toString());vi.stubEnv('AUDIT_PUBLIC_KEY_FINGERPRINT',manifest.activeFingerprint);vi.stubEnv('AUDIT_TRANSITION_JSON',JSON.stringify(manifest));vi.stubEnv('AUDIT_TRANSITION_SHA256',digest(manifest));
  const result=await settleAuction(db,lot.id);expect(result.settled).toBe(true);await flushCheckpoints(db,lot.id);
  expect((await settleAuction(db,lot.id)).settled).toBe(false);
  const report=await auditReport(db,lot.id);expect(report.status).toBe('INTEGRO');expect(report.records.slice(0,2)).toEqual(prior.records);
  expect(report.signatureKeys?.map(k=>k.fingerprint)).toEqual([manifest.legacyFingerprint,manifest.legacyFingerprint,manifest.activeFingerprint]);
  expect(await getReceipt(db,result.receiptId!)).toMatchObject({amountCents:5000,signingFingerprint:manifest.activeFingerprint,verification:'INTEGRO'});
  for(const [path,text]of originalObjects)expect(objects.get(path)).toBe(text);
  const balances=await pool.query('SELECT total_cents,committed_cents FROM wallets WHERE user_id=$1',[buyer.id]);expect(balances.rows[0]).toEqual({total_cents:'5000',committed_cents:'0'});
  // A separate rollback fixture is unnecessary: remove a pinned database event
  // only inside this isolated schema, then ensure financial/history checks fail.
  await pool.query('DELETE FROM audit_records WHERE auction_id=$1 AND sequence=1',[lot.id]);
  const corrupted=await auditReport(db,lot.id);expect(corrupted.status).toBe('ADULTERADO');expect(corrupted.issues.some(i=>i.includes('transição'))).toBe(true);
  expect((await auditStore()).transition?.id).toBe(manifest.id);
},15000);
