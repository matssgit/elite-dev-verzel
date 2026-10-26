import { generateKeyPairSync,createHash,randomUUID } from 'node:crypto';
import { describe,it,expect,vi,beforeEach } from 'vitest';
const state=vi.hoisted(()=>({objects:new Map<string,string>(),fail:false,pageSize:1}));
vi.mock('@vercel/blob',()=>({
  get:async(path:string)=>{if(state.fail)throw new Error('storage offline');const body=state.objects.get(path);return body===undefined?null:{statusCode:200,stream:new Response(body).body};},
  put:async(path:string,body:string,options:{allowOverwrite:boolean})=>{if(state.fail)throw new Error('storage offline');if(options.allowOverwrite || state.objects.has(path))throw new Error('conflict');state.objects.set(path,body);},
  list:async({prefix,cursor}:{prefix:string;cursor?:string})=>{if(state.fail)throw new Error('storage offline');const all=[...state.objects.keys()].filter(k=>k.startsWith(prefix));const index=Number(cursor??0);return {blobs:all.slice(index,index+state.pageSize).map(pathname=>({pathname})),hasMore:index+state.pageSize<all.length,cursor:String(index+state.pageSize)};},
}));
import { AuditStore } from '../src/audit/store.js';
const pair=generateKeyPairSync('ed25519');const pem=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
const fingerprint=createHash('sha256').update(pair.publicKey.export({type:'spki',format:'pem'})).digest('hex');
const open=()=>AuditStore.openBlob('test-token','test-v1/',pem,fingerprint);
beforeEach(()=>{state.objects.clear();state.fail=false;});
describe('remote independent audit',()=>{
  it('preserves checkpoints across store instances and paginated listings; concurrent replay does not overwrite',async()=>{
    const store=await open();const id=randomUUID();const first=store.sign(id,0,'0'.repeat(64),{type:'OPEN'});const second=store.sign(id,1,first.hash,{type:'BID'});
    await Promise.all([store.publish(first),store.publish(first)]);await store.publish(second);
    expect(await (await open()).checkpoints(id)).toEqual([first,second]);
    await expect(store.publish(store.sign(id,1,first.hash,{type:'BID',amount:900}))).rejects.toThrow();
    expect(await store.checkpoints(id)).toEqual([first,second]);
  });
  it('fails closed on unavailable storage and gaps in the independent chain',async()=>{
    const store=await open();const id=randomUUID();await store.publish(store.sign(id,1,'0'.repeat(64),{type:'BID'}));
    await expect(store.checkpoints(id)).rejects.toThrow('gaps');state.fail=true;
    await expect(store.checkpoints(id)).rejects.toThrow('offline');
    await expect(open()).rejects.toThrow('offline');
  });
  it('refuses missing/rotated signing keys and a conflicting public pin',async()=>{
    await open();await expect(AuditStore.openBlob('test-token','test-v1/','',fingerprint)).rejects.toThrow();
    await expect(AuditStore.openBlob('test-token','test-v1/',pem,'0'.repeat(64))).rejects.toThrow('fingerprint');
    state.objects.set('test-v1/public.pem','tampered');await expect(open()).rejects.toThrow('conflict');
  });
});
