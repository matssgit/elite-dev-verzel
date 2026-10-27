import { defineConfig } from '@neon/config/v1';
for(const name of ['AUDIT_PRIVATE_KEY','AUDIT_PUBLIC_KEY_FINGERPRINT','AUDIT_TRANSITION_JSON','AUDIT_TRANSITION_SHA256'])if(!process.env[name])throw new Error('Missing protected operator configuration');
// Native operator handoff only. SQL/Blob credentials are omitted/preserved.
export default defineConfig({functions:{settlement:{name:'Elite auction settlement',source:'./apps/api/src/settlement/function.ts',env:{FINANCIAL_MAINTENANCE:'true',AUDIT_PRIVATE_KEY:process.env.AUDIT_PRIVATE_KEY!,AUDIT_PUBLIC_KEY_FINGERPRINT:process.env.AUDIT_PUBLIC_KEY_FINGERPRINT!,AUDIT_TRANSITION_JSON:process.env.AUDIT_TRANSITION_JSON!,AUDIT_TRANSITION_SHA256:process.env.AUDIT_TRANSITION_SHA256!}}}});
