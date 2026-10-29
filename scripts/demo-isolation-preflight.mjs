import { createPrivateKey,createPublicKey,createHash } from 'node:crypto';
import { fileURLToPath,URL } from 'node:url';
import { resolve } from 'node:path';
import process from 'node:process';
import { log } from 'node:console';

export function assertDemoIsolation(env) {
  let stage='DATABASE_URL';
  const fail=details=>{const error=Error('Demo isolation mismatch; refusing database/bootstrap access. Secret values omitted.');error.code=stage;if(details)error.details=details;throw error;};
  let url;try{url=new URL(env.DATABASE_URL??'');}catch{fail();}
  stage='DATABASE_TARGET_TLS';
  if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!=='ep-aged-scene-b8uum2b8.c-14.us-east-1.aws.neon.tech'||!url.username||!url.password||!['require','verify-full'].includes(url.searchParams.get('sslmode')))fail();
  const token=env.BLOB_READ_WRITE_TOKEN??'',store=token.split('_')[3]?.toLowerCase();
  stage='BLOB_MODE';if(env.AUDIT_STORAGE!=='blob')fail();
  stage='BLOB_PREFIX';if(env.AUDIT_BLOB_PREFIX!=='elite-verzel-demo-v1/')fail();
  stage='BLOB_TOKEN_STORE';if(store!=='uq7seocwcjwkg0zw')fail({tokenPresent:token.length>0,expectedTokenPrefix:token.startsWith('vercel_blob_rw_'),noOuterWhitespace:token===token.trim(),noWrappingQuotes:!/^['"]|['"]$/.test(token),sdkStoreSegmentLengthIs16:store?.length===16});
  stage='RUNTIME_TRANSITION';
  if(env.NODE_ENV!=='production'||env.AUDIT_RECOVERY_MODE==='true'||env.AUDIT_TRANSITION_JSON||env.AUDIT_TRANSITION_SHA256)fail();
  const blocked=env.FINANCIAL_MAINTENANCE==='true'&&env.RUN_SETTLEMENT_JOBS==='false'&&env.ALLOW_DEMO_SEED==='false';
  const enabled=env.FINANCIAL_MAINTENANCE==='false'&&env.RUN_SETTLEMENT_JOBS==='true'&&env.ALLOW_DEMO_SEED==='true';
  stage='FINANCIAL_FLAGS';
  if(!blocked&&!enabled)fail();
  stage='PRIVATE_KEY_FORMAT';
  let fingerprint;
  try {
    const key=createPrivateKey((env.AUDIT_PRIVATE_KEY??'').replace(/\\n/g,'\n'));
    if(key.asymmetricKeyType!=='ed25519')fail();
    fingerprint=createHash('sha256').update(createPublicKey(key).export({type:'spki',format:'pem'})).digest('hex');
  }catch{fail();}
  stage='SIGNING_PIN';
  if(fingerprint!==env.AUDIT_PUBLIC_KEY_FINGERPRINT||[
    'dc3370282c6119b2a77433fc95c0c84fa6868b23f77e8d6ffd7027d872f3ece3',
    'cf2d363c00c091450177e17cf62d4be0b1f8c0f2be8a911a42e08444329d9c91',
    '07e8ccdec02da616cf480e19a0599271679ed625376bf8968837502b0af94ab2',
  ].includes(fingerprint))fail();
  return {fingerprint,blocked};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{assertDemoIsolation(process.env);log('Demo isolation preflight OK.');}
  catch(error){const codes=['DATABASE_URL','DATABASE_TARGET_TLS','BLOB_MODE','BLOB_PREFIX','BLOB_TOKEN_STORE','RUNTIME_TRANSITION','FINANCIAL_FLAGS','PRIVATE_KEY_FORMAT','SIGNING_PIN'];const code=codes.includes(error.code)?error.code:'UNKNOWN';process.stderr.write(`Demo isolation mismatch [${code}]; database/bootstrap not started. Secret values omitted.\n`);if(code==='BLOB_TOKEN_STORE'&&error.details)process.stderr.write(JSON.stringify({scope:'demo-token-shape',...error.details})+'\n');process.exitCode=1;}
}
