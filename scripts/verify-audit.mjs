import { readFile } from 'node:fs/promises';
import { createHash, verify } from 'node:crypto';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { log } from 'node:console';
const [path,expectedFingerprint]=process.argv.slice(2);
if(!path || !expectedFingerprint)throw new Error('Uso: node scripts/verify-audit.mjs evidencia.json <fingerprint confiável obtido fora da página>');
const report=JSON.parse(await readFile(path,'utf8'));
function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return `[${v.map(canonical).join(',')}]`;return `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;}
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
if(createHash('sha256').update(report.publicKey).digest('hex')!==expectedFingerprint)throw new Error('Chave não corresponde à impressão digital confiável');
let previous='0'.repeat(64);
for(const [index,r] of report.records.entries()) {
 const unsigned={version:1,auctionId:r.auctionId,sequence:r.sequence,previousHash:r.previousHash,payload:r.payload};
 if(r.auctionId!==report.auctionId || r.sequence!==index || r.previousHash!==previous || r.hash!==hash(unsigned) || !verify(null,Buffer.from(r.hash,'hex'),report.publicKey,Buffer.from(r.signature,'base64')))throw new Error(`Evento ${index} inválido`);
 previous=r.hash;
}
if(!report.records.length || report.checkpoints.length!==report.records.length)throw new Error('Cobertura de checkpoints incompleta');
for(const [i,c] of report.checkpoints.entries())if(c.sequence!==i || canonical(c)!==canonical(report.records[i]))throw new Error('Checkpoint independente divergente');
if(report.issues.length)throw new Error(`Banco diverge dos registros assinados: ${report.issues.join('; ')}`);
log(`Assinaturas/cadeia/checkpoints conferem: ${report.records.length} eventos. ${report.legacyBaseline?'Baseline legado: sem garantia retroativa.':''}`);
