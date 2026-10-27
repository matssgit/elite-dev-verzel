import {generateKeyPairSync,sign} from 'node:crypto';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({queries:[] as string[],files:new Map<string,string>(),ended:false}));
vi.mock('../src/db/client.js',()=>({connect:()=>({pool:{query:async()=>({rows:[]}),connect:async()=>({query:async(sql:string)=>{state.queries.push(sql);return {rows:sql.startsWith('SELECT COALESCE')?[{rows:[]}]:[]};},release:()=>{}}),end:async()=>{state.ended=true;}}})}));
vi.mock('../src/audit/blob.js',()=>({BlobCheckpoints:class{constructor(_token:string,private prefix:string){}async read(path:string){return state.files.get(this.prefix+path)??null;}async names(){return [];}async writeOnce(){throw Error('WRITE MUST NEVER BE CALLED');}}}));
import {auditDiagnostics,auditIdentitySummary,buildAuditRecoveryApp} from '../src/audit/diagnostics.js';
import {publicFingerprint,digest} from '../src/audit/crypto.js';
import {incidentPins} from '../src/audit/incident-pins.js';
beforeEach(()=>{state.queries=[];state.files.clear();state.ended=false;for(const [key,value]of Object.entries({FINANCIAL_MAINTENANCE:'true',AUDIT_RECOVERY_MODE:'true',RUN_SETTLEMENT_JOBS:'false',AUDIT_BLOB_PREFIX:'elite-v1/',BLOB_READ_WRITE_TOKEN:'private-fixture-token',DATABASE_URL:'postgres://fixture@localhost/fixture',AUDIT_PRIVATE_KEY:'bad-fixture-private',AUDIT_PUBLIC_KEY_FINGERPRINT:incidentPins.withdrawnFingerprint,AUDIT_TRANSITION_JSON:'',AUDIT_TRANSITION_SHA256:''}))vi.stubEnv(key,value);});
afterEach(()=>vi.unstubAllEnvs());
it('reports an invalid key without leaking values, errors or financial rows',async()=>{
  const response=await auditDiagnostics(),text=await response.text(),body=JSON.parse(text);
  expect(response.status).toBe(200);expect(body.identity.privateKeyParseable).toBe(false);
  for(const forbidden of ['bad-fixture-private','private-fixture-token','postgres://','wallets','records','checkpoints','signature','balance'])expect(text).not.toContain('"'+forbidden+'"');
  expect(text).not.toContain('bad-fixture-private');expect(text).not.toContain('private-fixture-token');
  expect(state.queries[0]).toContain('READ ONLY');expect(state.queries.at(-1)).toBe('ROLLBACK');expect(state.queries.some(q=>/INSERT|UPDATE|DELETE|NOTIFY/.test(q))).toBe(false);expect(state.ended).toBe(true);
});
it('derives only a public fingerprint and detects mismatched public settings',()=>{
  const pair=generateKeyPairSync('ed25519'),pem=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
  const fp=publicFingerprint(pair.publicKey.export({type:'spki',format:'pem'}).toString());
  vi.stubEnv('AUDIT_PRIVATE_KEY',pem);expect(auditIdentitySummary()).toMatchObject({derivedFingerprint:fp,privateMatchesConfigured:false});
  vi.stubEnv('AUDIT_PUBLIC_KEY_FINGERPRINT',fp);expect(auditIdentitySummary().privateMatchesConfigured).toBe(true);expect(JSON.stringify(auditIdentitySummary())).not.toContain(pem);
});
it('checks all three public settings even if the private key is malformed',()=>{
  const pair=generateKeyPairSync('ed25519'),publicKey=pair.publicKey.export({type:'spki',format:'pem'}).toString(),fp=publicFingerprint(publicKey);
  const unsigned={version:1,scope:'elite-audit-key-transition',id:'170a1f02-b0a2-4ebc-98da-acf677119dff',createdAt:'2026-10-27T00:38:08.366Z',namespace:'elite-v1/',legacyPublicKey:incidentPins.rootPublicKey,legacyFingerprint:incidentPins.rootFingerprint,legacyKeyStatus:'potentially-compromised',activePublicKey:publicKey,activeFingerprint:fp,boundaries:incidentPins.boundaries.map(({auctionId,sequence,hash})=>({auctionId,sequence,hash}))};
  const manifest={...unsigned,signature:sign(null,Buffer.from(digest(unsigned),'hex'),pair.privateKey).toString('base64')};
  vi.stubEnv('AUDIT_PUBLIC_KEY_FINGERPRINT',fp);vi.stubEnv('AUDIT_TRANSITION_JSON',JSON.stringify(manifest));vi.stubEnv('AUDIT_TRANSITION_SHA256',digest(manifest));
  expect(auditIdentitySummary()).toMatchObject({privateKeyParseable:false,transitionValid:true,computedManifestHash:digest(manifest)});
});
it('is unavailable without both recovery and maintenance gates',async()=>{vi.stubEnv('AUDIT_RECOVERY_MODE','false');expect((await auditDiagnostics()).status).toBe(404);expect(state.queries).toHaveLength(0);vi.stubEnv('AUDIT_RECOVERY_MODE','true');vi.stubEnv('FINANCIAL_MAINTENANCE','false');expect((await auditDiagnostics()).status).toBe(404);});
it('recovery server blocks all mutations and never initializes the signer',async()=>{
  const app=await buildAuditRecoveryApp('fixture');try{for(const path of ['/wallet/deposits','/auctions','/anything'])expect((await app.inject({method:'POST',url:path,payload:{}})).statusCode).toBe(503);expect((await app.inject('/health')).json()).toEqual({status:'maintenance',recovery:true});}finally{await app.close();}
});
