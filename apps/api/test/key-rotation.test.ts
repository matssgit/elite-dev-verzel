import { generateKeyPairSync,sign,randomUUID } from 'node:crypto';
import { beforeEach,it,expect,vi } from 'vitest';
import type { AuditRecord,AuditTransition } from '@elite/shared';
const state=vi.hoisted(()=>({objects:new Map<string,string>()}));
vi.mock('@vercel/blob',()=>({
  get:async(path:string)=>{const text=state.objects.get(path);return text===undefined?null:{statusCode:200,stream:new Response(text).body};},
  put:async(path:string,text:string,options:{allowOverwrite:boolean})=>{if(options.allowOverwrite||state.objects.has(path))throw Error('conflict');state.objects.set(path,text);},
  list:async({prefix}:{prefix:string})=>({blobs:[...state.objects.keys()].filter(k=>k.startsWith(prefix)).map(pathname=>({pathname})),hasMore:false}),
}));
import { AuditStore,canonical,digest } from '../src/audit/store.js';
import { publicFingerprint } from '../src/audit/crypto.js';
import { parseTransition,transitionUnsigned } from '../src/audit/rotation.js';
import { verifyReport } from '../../../scripts/audit-verification.mjs';
const key=()=>{const pair=generateKeyPairSync('ed25519');const publicKey=pair.publicKey.export({type:'spki',format:'pem'}).toString();return {privateKey:pair.privateKey,pem:pair.privateKey.export({type:'pkcs8',format:'pem'}).toString(),publicKey,fp:publicFingerprint(publicKey)};};
const old=key(),next=key(),prefix='rotation-test/',id=randomUUID();
let legacy:AuditStore,transition:AuditTransition,original:AuditRecord[];
const config=()=>({json:JSON.stringify(transition),hash:digest(transition)});
const open=()=>AuditStore.openBlob('fixture',prefix,next.pem,next.fp,config());
beforeEach(async()=>{
  state.objects.clear();legacy=await AuditStore.openBlob('fixture',prefix,old.pem,old.fp);
  const root=legacy.sign(id,0,'0'.repeat(64),{type:'OPEN'}),bid=legacy.sign(id,1,root.hash,{type:'BID'});original=[root,bid];
  for(const r of original)await legacy.publish(r);
  transition={version:1,scope:'elite-audit-key-transition',id:randomUUID(),createdAt:new Date().toISOString(),namespace:prefix,legacyPublicKey:old.publicKey,legacyFingerprint:old.fp,legacyKeyStatus:'potentially-compromised',activePublicKey:next.publicKey,activeFingerprint:next.fp,boundaries:[{auctionId:id,sequence:1,hash:bid.hash}],signature:''};
  transition.signature=sign(null,Buffer.from(digest(transitionUnsigned(transition)),'hex'),next.privateKey).toString('base64');
});
it('preserves original bytes and verifies mixed signatures after reopening the independent store',async()=>{
  const originalObjects=new Map(state.objects),store=await open();
  const record=store.sign(id,2,original[1]!.hash,{type:'SETTLE'});expect(record.payload.signingKeyFingerprint).toBe(next.fp);
  await store.publish(record);const reopened=await open();expect(await reopened.checkpoints(id)).toEqual([...original,record]);
  for(const [path,body]of originalObjects)expect(state.objects.get(path)).toBe(body);
  expect(state.objects.get(prefix+'public.pem')).toBe(old.publicKey);expect(state.objects.get(prefix+`keys/${next.fp}.pem`)).toBe(next.publicKey);
  const records=[...original,record],report={auctionId:id,records,checkpoints:records,issues:[],publicKey:next.publicKey,fingerprint:next.fp,...store.trustMetadata,signatureKeys:records.map(r=>({sequence:r.sequence,fingerprint:store.signingFingerprint(r)}))};
  expect(verifyReport(report,old.fp,digest(transition)).events).toBe(3);
  expect(()=>verifyReport(report,old.fp)).toThrow();expect(()=>verifyReport({...report,transition:undefined},old.fp,digest(transition))).toThrow();
  expect(()=>verifyReport({...report,signatureKeys:[]},old.fp,digest(transition))).toThrow();
});
it('rejects an old-key forged suffix even with an active-key marker and valid cryptography',async()=>{
  const store=await open(),forged=legacy.sign(id,2,original[1]!.hash,{type:'SETTLE',signingKeyFingerprint:next.fp});
  expect(legacy.valid(forged)).toBe(true);expect(store.valid(forged)).toBe(false);await expect(store.publish(forged)).rejects.toThrow();
  expect(()=>store.sign(id,1,original[0]!.hash,{type:'BID'})).toThrow('historical');
});
it('requires active signatures from OPEN for lots outside the historical boundary list',async()=>{
  const store=await open(),fresh=randomUUID();
  expect(store.valid(legacy.sign(fresh,0,'0'.repeat(64),{type:'OPEN'}))).toBe(false);
  const root=store.sign(fresh,0,'0'.repeat(64),{type:'OPEN'});await store.publish(root);expect(await (await open()).checkpoints(fresh)).toEqual([root]);
});
it('refuses historical rollback in independent storage and database chains',async()=>{
  const store=await open();expect(()=>store.assertBoundary(original.slice(0,1),id)).toThrow('boundary');
  state.objects.delete(prefix+`checkpoints/${id}/1.json`);await expect(open()).rejects.toThrow('boundary');
});
it('refuses hash, signer, namespace and duplicate-boundary mismatches before writing rotation objects',async()=>{
  const count=state.objects.size;await expect(AuditStore.openBlob('fixture',prefix,next.pem,next.fp,{json:config().json,hash:'0'.repeat(64)})).rejects.toThrow('hash');
  const invalid={...transition,signature:sign(null,Buffer.from(digest(transitionUnsigned(transition)),'hex'),old.privateKey).toString('base64')};
  expect(()=>parseTransition(JSON.stringify(invalid),digest(invalid),next.fp)).toThrow('signature');
  const duplicate={...transition,boundaries:[...transition.boundaries,...transition.boundaries]};expect(()=>parseTransition(JSON.stringify(duplicate),digest(duplicate),next.fp)).toThrow('Duplicate');
  await expect(AuditStore.openBlob('fixture','wrong/',next.pem,next.fp,config())).rejects.toThrow('namespace');expect(state.objects.size).toBe(count);
});
it('blocks legacy-only consumers after activation and changed remote guards',async()=>{
  await open();await expect(AuditStore.openBlob('fixture',prefix,old.pem,old.fp)).rejects.toThrow('legacy-only');
  state.objects.set(prefix+'rotation.json','changed');await expect(open()).rejects.toThrow('guard');
});
it('replays historical and new outbox objects without overwriting or duplicating',async()=>{
  const store=await open();for(const record of original)await store.publish(record);
  const record=store.sign(id,2,original[1]!.hash,{type:'SETTLE'});await store.publish(record);const count=state.objects.size;
  const restarted=await open();await restarted.publish(record);for(const oldRecord of original)await restarted.publish(oldRecord);
  expect(state.objects.size).toBe(count);expect(state.objects.get(prefix+`checkpoints/${id}/1.json`)).toBe(canonical(original[1]));
});
