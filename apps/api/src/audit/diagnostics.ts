import { createPrivateKey,createPublicKey,verify } from 'node:crypto';
import Fastify from 'fastify';
import { connect } from '../db/client.js';
import { BlobCheckpoints } from './blob.js';
import { canonical,digest,publicFingerprint } from './crypto.js';
import { parseTransition } from './rotation.js';
import { incidentPins as pins } from './incident-pins.js';
import type { AuditRecord } from '@elite/shared';
import type { PoolClient } from 'pg';

// Metadata/booleans ONLY: never return rows, balances, checkpoint contents,
// object listings, environment values, raw errors or private material.
export function auditIdentitySummary() {
  const pem=process.env.AUDIT_PRIVATE_KEY;let derivedFingerprint:string|null=null,parseable=false,ed25519=false;
  if(pem)try{const key=createPrivateKey(pem.replace(/\\n/g,'\n'));ed25519=key.asymmetricKeyType==='ed25519';derivedFingerprint=publicFingerprint(createPublicKey(key).export({type:'spki',format:'pem'}).toString());parseable=true;}catch{/* no raw error/value */}
  const configured=process.env.AUDIT_PUBLIC_KEY_FINGERPRINT??'',valid=/^[a-f0-9]{64}$/.test(configured);
  const manifestHash=process.env.AUDIT_TRANSITION_SHA256??'',raw=process.env.AUDIT_TRANSITION_JSON;
  let computedManifestHash:string|null=null,manifestValid=false;
  if(raw)try{computedManifestHash=digest(JSON.parse(raw));parseTransition(raw,manifestHash,configured);manifestValid=true;}catch{/* no raw data */}
  return {privateKeyPresent:Boolean(pem),privateKeyParseable:parseable,ed25519,derivedFingerprint,configuredFingerprint:valid?configured:null,privateMatchesConfigured:parseable&&valid&&derivedFingerprint===configured,privateIdentityKnownCompromised:derivedFingerprint===pins.rootFingerprint||derivedFingerprint===pins.withdrawnFingerprint,transitionPresent:Boolean(raw),transitionHash:/^[a-f0-9]{64}$/.test(manifestHash)?manifestHash:null,computedManifestHash,transitionValid:manifestValid,threePublicVariablesMatchPrepared:configured===pins.withdrawnFingerprint&&manifestHash===pins.withdrawnManifestHash&&computedManifestHash===pins.withdrawnManifestHash&&manifestValid};
}
export function observedHistoryValid(records:AuditRecord[],checkpoints:AuditRecord[],id:string){
  const boundary=pins.boundaries.find(b=>b.auctionId===id);if(!boundary||records.length!==boundary.events||records.at(-1)?.hash!==boundary.hash||canonical(records)!==canonical(checkpoints))return false;
  let previous='0'.repeat(64);
  for(const [index,r]of records.entries()){
    const unsigned={version:1,auctionId:r.auctionId,sequence:r.sequence,previousHash:r.previousHash,payload:r.payload};
    if(r.auctionId!==id||r.sequence!==index||r.previousHash!==previous||digest(unsigned)!==r.hash||!verify(null,Buffer.from(r.hash,'hex'),pins.rootPublicKey,Buffer.from(r.signature,'base64')))return false;previous=r.hash;
  }return true;
}
export async function auditDiagnostics():Promise<Response> {
  if(process.env.FINANCIAL_MAINTENANCE!=='true'||process.env.AUDIT_RECOVERY_MODE!=='true')return new Response('Not found',{status:404});
  const common={checkedAt:new Date().toISOString(),maintenance:true,recoveryMode:true,runtime:process.env.RENDER==='true'?'render':'neon',commit:process.env.RENDER_GIT_COMMIT??null,jobsDisabled:process.env.RUN_SETTLEMENT_JOBS==='false',identity:auditIdentitySummary(),financialWritesExecuted:false,blobWritesExecuted:false};
  let stage='configuration';const url=process.env.DATABASE_URL_UNPOOLED??process.env.DATABASE_URL;
  if(!url||process.env.AUDIT_BLOB_PREFIX!=='elite-v1/')return Response.json({...common,ok:false,stage},{status:503});
  const {pool}=connect(url);let client:PoolClient|undefined;
  try {
    stage='database';client=await pool.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot:Record<string,unknown>={};
    for(const [table,order]of Object.entries({wallets:'user_id',wallet_entries:'id',auctions:'id',bids:'id',receipts:'id',audit_records:'auction_id,sequence'}))snapshot[table]=(await client.query(`SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY ${order}),'[]'::jsonb) AS rows FROM ${table} t`)).rows[0]!.rows;
    const rows=(await client.query<AuditRecord>(`SELECT auction_id AS "auctionId",sequence,previous_hash AS "previousHash",payload,hash,signature FROM audit_records ORDER BY auction_id,sequence`)).rows;
    stage='independent-read';const blob=new BlobCheckpoints(process.env.BLOB_READ_WRITE_TOKEN??'','elite-v1/');
    const root=await blob.read('public.pem'),guardText=await blob.read('rotation.json');
    const withdrawnKeyObject=await blob.read(`keys/${pins.withdrawnFingerprint}.pem`);
    const withdrawnManifestObject=await blob.read(`transitions/${pins.withdrawnManifestId}.json`);
    let withdrawnManifestObjectMatches=false;
    if(withdrawnManifestObject!==null)try{withdrawnManifestObjectMatches=digest(JSON.parse(withdrawnManifestObject))===pins.withdrawnManifestHash;}catch{/* boolean only */}
    let guardMatchesPrepared=false,guardFingerprint:string|null=null;
    if(guardText!==null)try{const guard=JSON.parse(guardText);guardMatchesPrepared=guard.transitionHash===pins.withdrawnManifestHash&&guard.activeFingerprint===pins.withdrawnFingerprint;guardFingerprint=/^[a-f0-9]{64}$/.test(guard.activeFingerprint)?guard.activeFingerprint:null;}catch{/* return boolean only */}
    let checkpointCount=0,allHistoriesMatchObserved=true;
    for(const boundary of pins.boundaries){
      const names=await blob.names(`checkpoints/${boundary.auctionId}/`);if(names.some(n=>!/^\d+\.json$/.test(n)))throw Error('unexpected checkpoint name');
      const checkpoints:AuditRecord[]=[];
      for(const name of names.sort((a,b)=>Number(a.split('.')[0])-Number(b.split('.')[0]))){const body=await blob.read(`checkpoints/${boundary.auctionId}/${name}`);if(body===null)throw Error('missing checkpoint');checkpoints.push(JSON.parse(body));}
      checkpointCount+=checkpoints.length;allHistoriesMatchObserved=observedHistoryValid(rows.filter(r=>r.auctionId===boundary.auctionId),checkpoints,boundary.auctionId)&&allHistoriesMatchObserved;
    }
    return Response.json({...common,ok:true,rootPinMatches:root===pins.rootPublicKey,rotationGuardPresent:guardText!==null,guardMatchesPrepared,guardFingerprint,withdrawnPublicKeyObjectPresent:withdrawnKeyObject!==null,withdrawnPublicKeyObjectMatches:withdrawnKeyObject===pins.withdrawnPublicKey,withdrawnManifestObjectPresent:withdrawnManifestObject!==null,withdrawnManifestObjectMatches,checkpointCount,allHistoriesMatchObserved,unexpectedAuditAuctionCount:new Set(rows.filter(r=>!pins.boundaries.some(b=>b.auctionId===r.auctionId)).map(r=>r.auctionId)).size,financialSnapshotMatchesObserved:digest(snapshot)===pins.knownFinancialSnapshotHash});
  }catch{return Response.json({...common,ok:false,stage},{status:503});}
  finally{if(client){await client.query('ROLLBACK').catch(()=>{});client.release();}await pool.end();}
}
export async function buildAuditRecoveryApp(databaseUrl:string){
  if(process.env.FINANCIAL_MAINTENANCE!=='true'||process.env.AUDIT_RECOVERY_MODE!=='true'||process.env.RUN_SETTLEMENT_JOBS!=='false')throw Error('Recovery requires maintenance and disabled jobs');
  const app=Fastify({logger:false});const {pool}=connect(databaseUrl);
  app.addHook('onRequest',async(req,reply)=>{if(req.method!=='GET')return reply.code(503).send({code:'MAINTENANCE'});});
  app.get('/health',async()=>{await pool.query('SELECT 1');return {status:'maintenance',recovery:true};});
  app.get('/audit/diagnostics',async(_req,reply)=>{const response=await auditDiagnostics();return reply.code(response.status).send(await response.json());});
  app.addHook('onClose',async()=>{await pool.end();});return app;
}
