import { defineConfig } from '@neon/config/v1';
import {readFileSync} from 'node:fs';
for(const name of ['AUDIT_PRIVATE_KEY','AUDIT_PUBLIC_KEY_FINGERPRINT','AUDIT_TRANSITION_JSON','AUDIT_TRANSITION_SHA256'])if(!process.env[name])throw new Error('Missing protected operator configuration');
const incident=JSON.parse(readFileSync('docs/AUDIT_KEY_INCIDENT.json','utf8')) as {compromisedFingerprints:string[]};
if(incident.compromisedFingerprints.includes(process.env.AUDIT_PUBLIC_KEY_FINGERPRINT!))throw new Error('Compromised signing identity refused');
// Native operator handoff only. SQL/Blob credentials are omitted/preserved.
export default defineConfig({functions:{settlement:{name:'Elite auction settlement',source:'./apps/api/src/settlement/function.ts',env:{FINANCIAL_MAINTENANCE:'true',AUDIT_RECOVERY_MODE:'true',RUN_SETTLEMENT_JOBS:'false',AUDIT_PRIVATE_KEY:process.env.AUDIT_PRIVATE_KEY!,AUDIT_PUBLIC_KEY_FINGERPRINT:process.env.AUDIT_PUBLIC_KEY_FINGERPRINT!,AUDIT_TRANSITION_JSON:process.env.AUDIT_TRANSITION_JSON!,AUDIT_TRANSITION_SHA256:process.env.AUDIT_TRANSITION_SHA256!}}}});
