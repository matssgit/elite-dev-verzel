import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { generateKeyPairSync,createHash } from 'node:crypto';
const state=vi.hoisted(()=>({files:new Map<string,string>(),queries:[] as string[],connected:0,released:false,ended:false,transition:undefined as {legacyPublicKey:string}|undefined,stats:{bad_reserves:'0',bad_settlements:'0',pending:'1',settled:'4',old_connections:'0',migrations:'3'}}));
vi.mock('../src/audit/store.js',()=>({auditStore:async()=>({transition:state.transition,trustMetadata:{}})}));
vi.mock('../src/db/client.js',()=>({connect:()=>{state.connected++;return {pool:{connect:async()=>({query:async(text:string)=>{state.queries.push(text);return {rows:[state.stats]};},release:()=>{state.released=true;}}),end:async()=>{state.ended=true;}}};}}));
vi.mock('../src/audit/blob.js',()=>({BlobCheckpoints:class {
  constructor(private token:string,private prefix:string){}
  async read(path:string){return state.files.get(this.prefix+path)??null;}
  async writeOnce(path:string,body:string){const key=this.prefix+path;const previous=state.files.get(key);if(previous!==undefined&&previous!==body)throw new Error('conflict');state.files.set(key,body);}
}}));
import { rotationReadiness } from '../src/settlement/readiness.js';
const pair=generateKeyPairSync('ed25519');const publicKey=pair.publicKey.export({type:'spki',format:'pem'}).toString();
const pem=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
beforeEach(()=>{
  state.files.clear();state.files.set('elite-v1/public.pem',publicKey);state.queries=[];state.connected=0;state.released=false;state.ended=false;state.stats.old_connections='0';state.transition=undefined;
  for(const [key,value]of Object.entries({DATABASE_URL:'postgres://unused:unused@localhost/unused',FINANCIAL_MAINTENANCE:'true',ROTATION_SESSION_CUTOFF:'2026-10-26T23:32:02Z',ROTATION_PROBE_ID:'00000000-0000-4000-8000-000000000555',AUDIT_PRIVATE_KEY:pem,AUDIT_PUBLIC_KEY_FINGERPRINT:createHash('sha256').update(publicKey).digest('hex'),BLOB_READ_WRITE_TOKEN:'fixture-token',AUDIT_BLOB_PREFIX:'elite-v1/'}))vi.stubEnv(key,value);
});
afterEach(()=>vi.unstubAllEnvs());
it('checks financial state in a read-only transaction and writes only one isolated probe',async()=>{
  const response=await rotationReadiness();const body=await response.json();
  expect(response.status).toBe(200);expect(body).toMatchObject({ok:true,maintenance:true,pendingSettlements:1,preRotationConnections:0,blobWriteProbe:true,automaticSettlementExecuted:false});
  expect(state.queries[0]).toContain('READ ONLY');expect(state.queries.at(-1)).toBe('ROLLBACK');
  expect([...state.files.keys()]).toEqual(['elite-v1/public.pem','rotation-probes/00000000-0000-4000-8000-000000000555.json']);
  expect(JSON.stringify(body)).not.toContain(pem);expect(JSON.stringify(body)).not.toContain('fixture-token');
  expect(state.released&&state.ended).toBe(true);
});
it('refuses pre-rotation SQL connections without writing a probe',async()=>{
  state.stats.old_connections='1';const response=await rotationReadiness();
  expect(response.status).toBe(503);expect(await response.json()).toMatchObject({stage:'financial-invariants'});
  expect(state.files.size).toBe(1);expect(state.released&&state.ended).toBe(true);
});
it('refuses a changed independent pin without overwriting it',async()=>{
  state.files.set('elite-v1/public.pem','changed');const response=await rotationReadiness();
  expect(response.status).toBe(503);expect(await response.json()).toMatchObject({stage:'blob-read'});
  expect(state.files.get('elite-v1/public.pem')).toBe('changed');expect(state.files.size).toBe(1);
});
it('is unavailable when maintenance is disabled',async()=>{
  vi.stubEnv('FINANCIAL_MAINTENANCE','false');expect((await rotationReadiness()).status).toBe(404);expect(state.connected).toBe(0);
});
it('keeps the historical public pin and earlier probe when the active signer changes',async()=>{
  vi.stubEnv('AUDIT_TRANSITION_JSON','fixture');state.transition={legacyPublicKey:'historical-public-key'};state.files.set('elite-v1/public.pem','historical-public-key');
  const original='rotation-probes/00000000-0000-4000-8000-000000000555.json';state.files.set(original,'old probe');
  const response=await rotationReadiness();expect(response.status).toBe(200);expect(state.files.get(original)).toBe('old probe');
  expect([...state.files.keys()].filter(k=>k.startsWith('rotation-probes/'))).toHaveLength(2);
});
