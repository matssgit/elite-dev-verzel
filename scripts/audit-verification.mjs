import { createHash,createPublicKey,verify } from 'node:crypto';
import { Buffer } from 'node:buffer';
export function canonical(v){
  if(v===null||typeof v==='string'||typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v)))return JSON.stringify(v);
  if(Array.isArray(v))return `[${v.map(canonical).join(',')}]`;
  if(v&&typeof v==='object')return `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  throw Error('Invalid canonical value');
}
export const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
export const fingerprint=pem=>createHash('sha256').update(pem).digest('hex');
const check=(condition,message)=>{if(!condition)throw Error(message);};
export function verifyTransition(t,legacyPin,manifestPin){
  check(t&&/^[a-f0-9]{64}$/.test(manifestPin)&&hash(t)===manifestPin,'Manifesto não corresponde ao hash confiável');
  check(t.version===1&&t.scope==='elite-audit-key-transition'&&t.legacyKeyStatus==='potentially-compromised','Formato de transição inválido');
  check(t.legacyFingerprint===legacyPin&&fingerprint(t.legacyPublicKey)===legacyPin,'Raiz histórica não confiável');
  check(fingerprint(t.activePublicKey)===t.activeFingerprint&&t.activeFingerprint!==legacyPin,'Sucessora inválida');
  for(const pem of [t.legacyPublicKey,t.activePublicKey])check(createPublicKey(pem).asymmetricKeyType==='ed25519','Chave não Ed25519');
  check(Array.isArray(t.boundaries)&&t.boundaries.length>0&&new Set(t.boundaries.map(b=>b.auctionId)).size===t.boundaries.length,'Fronteiras duplicadas/ausentes');
  for(const b of t.boundaries)check(/^[a-f0-9-]{36}$/.test(b.auctionId)&&Number.isInteger(b.sequence)&&b.sequence>=0&&/^[a-f0-9]{64}$/.test(b.hash),'Fronteira inválida');
  const {signature,...unsigned}=t;
  check(verify(null,Buffer.from(hash(unsigned),'hex'),t.activePublicKey,Buffer.from(signature,'base64')),'Assinatura do manifesto inválida');return t;
}
export function verifyReport(report,legacyPin,manifestPin){
  const t=report.transition?verifyTransition(report.transition,legacyPin,manifestPin):undefined;
  check(!manifestPin||t,'Transição esperada foi removida do relatório');
  const active=t?.activeFingerprint??legacyPin;
  check(report.fingerprint===active&&fingerprint(report.publicKey)===active,'Chave pública do relatório divergente');
  if(t)check(report.transitionHash===manifestPin&&report.activeFingerprint===active,'Pin ativo/transição divergente');
  let previous='0'.repeat(64);const boundary=t?.boundaries.find(b=>b.auctionId===report.auctionId);
  for(const [index,r]of report.records.entries()){
    const old=boundary&&index<=boundary.sequence,key=old?t.legacyPublicKey:report.publicKey,fp=old?legacyPin:active;
    check(!t||(old?r.payload.signingKeyFingerprint===undefined||r.payload.signingKeyFingerprint===fp:r.payload.signingKeyFingerprint===fp),'Identificação da chave divergente');
    const unsigned={version:1,auctionId:r.auctionId,sequence:r.sequence,previousHash:r.previousHash,payload:r.payload};
    check(r.auctionId===report.auctionId&&r.sequence===index&&r.previousHash===previous&&r.hash===hash(unsigned)&&verify(null,Buffer.from(r.hash,'hex'),key,Buffer.from(r.signature,'base64')),`Evento ${index} inválido`);
    if(t)check(report.signatureKeys?.[index]?.sequence===index&&report.signatureKeys[index].fingerprint===fp,'Mapa de assinaturas divergente');previous=r.hash;
  }
  if(boundary)check(report.records[boundary.sequence]?.hash===boundary.hash,'Rollback da fronteira histórica');
  check(report.records.length>0&&report.checkpoints.length===report.records.length,'Cobertura de checkpoints incompleta');
  for(const [i,c]of report.checkpoints.entries())check(c.sequence===i&&canonical(c)===canonical(report.records[i]),'Checkpoint independente divergente');
  check(report.issues.length===0,'Banco diverge dos registros assinados');return {events:report.records.length,activeFingerprint:active,transitionHash:manifestPin??null};
}
