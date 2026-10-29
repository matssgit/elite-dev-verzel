import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateKeyPairSync,createHash } from 'node:crypto';
import { assertDemoIsolation } from '../demo-isolation-preflight.mjs';
const key=generateKeyPairSync('ed25519'); // Temporary fixture, never an operational identity.
const fingerprint=createHash('sha256').update(key.publicKey.export({type:'spki',format:'pem'})).digest('hex');
const env={NODE_ENV:'production',DATABASE_URL:'postgres://fixture:fixture@ep-aged-scene-b8uum2b8.c-14.us-east-1.aws.neon.tech/neondb?sslmode=require',BLOB_READ_WRITE_TOKEN:'vercel_blob_rw_UQ7SEOCwcjWKg0zw_PUBLIC-FIXTURE',AUDIT_STORAGE:'blob',AUDIT_BLOB_PREFIX:'elite-verzel-demo-v1/',AUDIT_PRIVATE_KEY:key.privateKey.export({type:'pkcs8',format:'pem'}).toString(),AUDIT_PUBLIC_KEY_FINGERPRINT:fingerprint,FINANCIAL_MAINTENANCE:'true',RUN_SETTLEMENT_JOBS:'false',ALLOW_DEMO_SEED:'false'};
test('accepts isolated demo blocked or explicitly enabled',()=>{
  assert.equal(assertDemoIsolation(env).blocked,true);
  assert.equal(assertDemoIsolation({...env,FINANCIAL_MAINTENANCE:'false',RUN_SETTLEMENT_JOBS:'true',ALLOW_DEMO_SEED:'true'}).blocked,false);
});
test('rejects wrong database, pooler or missing TLS before any bootstrap',()=>{
  for(const DATABASE_URL of ['postgres://fixture:fixture@localhost/demo?sslmode=require',env.DATABASE_URL.replace('.c-14','-pooler.c-14'),env.DATABASE_URL.replace('?sslmode=require','')])assert.throws(()=>assertDemoIsolation({...env,DATABASE_URL}));
});
test('rejects other store, namespace, pin or production transition',()=>{
  for(const patch of [{BLOB_READ_WRITE_TOKEN:'vercel_blob_rw_OTHER_PUBLIC-FIXTURE'},{AUDIT_BLOB_PREFIX:'elite-v1/'},{AUDIT_PUBLIC_KEY_FINGERPRINT:'a'.repeat(64)},{AUDIT_TRANSITION_JSON:'{}'}])assert.throws(()=>assertDemoIsolation({...env,...patch}));
});
test('rejects partial activation and never exposes secret inputs in errors',()=>{
  assert.throws(()=>assertDemoIsolation({...env,RUN_SETTLEMENT_JOBS:'true'}));
  assert.throws(()=>assertDemoIsolation({...env,AUDIT_PRIVATE_KEY:'SECRET-FIXTURE'}),error=>!error.message.includes('SECRET-FIXTURE'));
});
test('distinguishes Blob configuration failures with fixed public codes only',()=>{
  for(const [patch,code] of [[{AUDIT_STORAGE:'file'},'BLOB_MODE'],[{AUDIT_BLOB_PREFIX:'other/'},'BLOB_PREFIX'],[{BLOB_READ_WRITE_TOKEN:'PRIVATE-FIXTURE'},'BLOB_TOKEN_STORE']])assert.throws(()=>assertDemoIsolation({...env,...patch}),error=>error.code===code&&!error.message.includes('PRIVATE-FIXTURE'));
});
test('reports token shape only as booleans without returning token fragments',()=>{
  assert.throws(()=>assertDemoIsolation({...env,BLOB_READ_WRITE_TOKEN:'"PRIVATE-FIXTURE"'}),error=>Object.values(error.details).every(v=>typeof v==='boolean')&&error.details.tokenPresent&&!error.details.noWrappingQuotes&&!JSON.stringify(error.details).includes('PRIVATE-FIXTURE'));
});
