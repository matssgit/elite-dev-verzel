import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, open, link, unlink, realpath } from 'node:fs/promises';
import { resolve, join, isAbsolute, relative } from 'node:path';
import { projectRoot } from '../config.js';
import type { AuditRecord } from '@elite/shared';
import { BlobCheckpoints } from './blob.js';

export function canonical(value:unknown):string {
  if(value===null || typeof value==='boolean' || typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number' && Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(typeof value==='object' && value)return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical((value as Record<string,unknown>)[k])}`).join(',')}}`;
  throw new Error('Invalid canonical JSON');
}
export const digest=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
function unsigned(record:AuditRecord){return {version:1,auctionId:record.auctionId,sequence:record.sequence,previousHash:record.previousHash,payload:record.payload};}
export async function assertPersistentMount(directory:string) {
  const mount=process.env.AUDIT_MOUNT_PATH;
  if(process.platform!=='linux'||!mount||!isAbsolute(mount))throw new Error('Audit persistent mount requires Linux and absolute AUDIT_MOUNT_PATH');
  const info=await readFile('/proc/self/mountinfo','utf8');
  const decode=(value:string)=>value.replace(/\\([0-7]{3})/g,(_,octal:string)=>String.fromCharCode(parseInt(octal,8)));
  const mounted=info.split('\n').some(line=>{const target=line.split(' ')[4];return target&&decode(target)===mount;});
  if(!mounted||mount==='/')throw new Error('Audit mount is not an independently mounted filesystem; refusing ephemeral storage');
  await mkdir(directory,{recursive:true});
  const inside=relative(await realpath(mount),await realpath(directory));
  if(inside.startsWith('..')||isAbsolute(inside))throw new Error('Audit directory escapes the persistent mount');
}
// Publish via a durable temporary file + atomic hard link: never replace an existing checkpoint.
async function writeOnce(path:string,data:string) {
  const temporary=`${path}.${randomUUID()}.tmp`;
  const file=await open(temporary,'wx',0o600);
  try {await file.writeFile(data,'utf8');await file.sync();}finally{await file.close();}
  try {await link(temporary,path);}
  catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;if(await readFile(path,'utf8')!==data)throw new Error('Checkpoint/key conflict; existing evidence was preserved');}
  finally{await unlink(temporary).catch(()=>{});}
}
export class AuditStore {
  private constructor(readonly directory:string,private key:ReturnType<typeof createPrivateKey>,readonly publicKey:string,private remote?:BlobCheckpoints){}
  static async openBlob(token:string,prefix:string,pem:string,expectedFingerprint:string) {
    if(!pem || !/^[a-f0-9]{64}$/.test(expectedFingerprint))throw new Error('Blob audit requires protected signing key and pinned fingerprint');
    const key=createPrivateKey(pem.replace(/\\n/g,'\n'));
    const publicKey=createPublicKey(key).export({type:'spki',format:'pem'}).toString();
    const remote=new BlobCheckpoints(token,prefix);
    const store=new AuditStore(`blob:${prefix}`,key,publicKey,remote);
    if(store.fingerprint!==expectedFingerprint)throw new Error('Audit signing key does not match configured public fingerprint');
    await remote.writeOnce('public.pem',publicKey);
    return store;
  }
  static async open(directory:string) {
    if(process.env.NODE_ENV==='production'&&process.env.RENDER==='true'&&process.env.AUDIT_REQUIRE_MOUNT!=='true')throw new Error('Render production requires persistent mount verification');
    if(process.env.AUDIT_REQUIRE_MOUNT==='true')await assertPersistentMount(directory);
    await mkdir(join(directory,'checkpoints'),{recursive:true});
    let pem=process.env.AUDIT_PRIVATE_KEY?.replace(/\\n/g,'\n');
    if(!pem) {
      if(process.env.NODE_ENV==='production'&&(process.env.AUDIT_KEY_MODE!=='persistent-file'||process.env.AUDIT_REQUIRE_MOUNT!=='true'))throw new Error('Production requires AUDIT_PRIVATE_KEY or persistent-file mode on a verified mount');
      const path=join(directory,'private.pem');
      try{pem=await readFile(path,'utf8');}
      catch(error){
        if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
        try{await accessPublicPin(directory);throw new Error('Audit key missing with an existing public pin; restore original key');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
        if((await readdir(join(directory,'checkpoints'))).length)throw new Error('Audit key missing with existing checkpoints: restore the original key');
        const generated=generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'}).toString();
        try{await writeOnce(path,generated);}catch(error){if(!(await readFile(path,'utf8').catch(()=>'')))throw error;}
        pem=await readFile(path,'utf8');
      }
    }
    const key=createPrivateKey(pem);const publicKey=createPublicKey(key).export({type:'spki',format:'pem'}).toString();
    // Pin the key independently of PostgreSQL; fail startup instead of silently rotating it.
    await writeOnce(join(directory,'public.pem'),publicKey);
    return new AuditStore(directory,key,publicKey);
  }
  get fingerprint(){return createHash('sha256').update(this.publicKey).digest('hex');}
  sign(auctionId:string,sequence:number,previousHash:string,payload:Record<string,unknown>):AuditRecord {
    const record={auctionId,sequence,previousHash,payload,hash:'',signature:''};
    record.hash=digest(unsigned(record));record.signature=sign(null,Buffer.from(record.hash,'hex'),this.key).toString('base64');return record;
  }
  valid(record:AuditRecord) {
    try{return digest(unsigned(record))===record.hash && verify(null,Buffer.from(record.hash,'hex'),this.publicKey,Buffer.from(record.signature,'base64'));}catch{return false;}
  }
  async checkpoints(auctionId:string):Promise<AuditRecord[]> {
    if(!/^[a-f0-9-]{36}$/.test(auctionId))throw new Error('Invalid auction id');
    if(this.remote) {
      const prefix=`checkpoints/${auctionId}/`;const names=await this.remote.names(prefix);
      if(names.some(n=>!/^\d+\.json$/.test(n)))throw new Error('Unexpected checkpoint object');
      const records:AuditRecord[]=[];
      for(const name of names.sort((a,b)=>Number(a.split('.')[0])-Number(b.split('.')[0]))) {
        const text=await this.remote.read(prefix+name);if(text===null)throw new Error('Listed checkpoint disappeared');
        const record=JSON.parse(text) as AuditRecord;
        if(record.auctionId!==auctionId || record.sequence!==Number(name.split('.')[0]) || !this.valid(record))throw new Error('Invalid independent checkpoint');
        records.push(record);
      }
      if(records.some((r,i)=>r.sequence!==i || r.previousHash!==(i?records[i-1]!.hash:'0'.repeat(64))))throw new Error('Independent checkpoint chain has gaps');
      return records;
    }
    const directory=join(this.directory,'checkpoints',auctionId);
    let names:string[];try{names=await readdir(directory);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error;}
    return Promise.all(names.filter(n=>/^\d+\.json$/.test(n)).sort((a,b)=>Number(a.split('.')[0])-Number(b.split('.')[0])).map(async name=>JSON.parse(await readFile(join(directory,name),'utf8')) as AuditRecord));
  }
  async publish(record:AuditRecord) {
    if(!this.valid(record))throw new Error('Refusing to publish an invalid checkpoint signature');
    if(this.remote){await this.remote.writeOnce(`checkpoints/${record.auctionId}/${record.sequence}.json`,canonical(record));return;}
    const directory=join(this.directory,'checkpoints',record.auctionId);await mkdir(directory,{recursive:true});
    await writeOnce(join(directory,`${record.sequence}.json`),canonical(record));
  }
}
async function accessPublicPin(directory:string){await readFile(join(directory,'public.pem'),'utf8');}
const stores=new Map<string,Promise<AuditStore>>();
export function auditStore(directory?:string) {
  if(!directory && process.env.AUDIT_STORAGE==='blob') {
    const prefix=process.env.AUDIT_BLOB_PREFIX??'elite-v1/';const id=`blob:${prefix}`;
    if(!stores.has(id))stores.set(id,AuditStore.openBlob(process.env.BLOB_READ_WRITE_TOKEN??'',prefix,process.env.AUDIT_PRIVATE_KEY??'',process.env.AUDIT_PUBLIC_KEY_FINGERPRINT??''));
    return stores.get(id)!;
  }
  if(process.env.NODE_ENV==='production'&&!process.env.AUDIT_DIRECTORY)throw new Error('AUDIT_DIRECTORY must point to persistent independent storage in production');
  const path=resolve(projectRoot,directory??process.env.AUDIT_DIRECTORY??'var/audit');
  if(!stores.has(path))stores.set(path,AuditStore.open(path));return stores.get(path)!;
}
