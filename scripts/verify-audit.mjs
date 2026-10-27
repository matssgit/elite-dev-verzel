import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { log } from 'node:console';
import { verifyReport } from './audit-verification.mjs';
const [path,expectedFingerprint,transitionHash]=process.argv.slice(2);
if(!path || !expectedFingerprint)throw new Error('Uso: node scripts/verify-audit.mjs evidencia.json <pin raiz histórica confiável> [hash manifesto confiável]');
const report=JSON.parse(await readFile(path,'utf8'));
verifyReport(report,expectedFingerprint,transitionHash);
log(`Assinaturas/cadeia/checkpoints conferem: ${report.records.length} eventos. ${report.legacyBaseline?'Baseline legado: sem garantia retroativa.':''}`);
