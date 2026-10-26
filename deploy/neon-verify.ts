import { defineConfig } from '@neon/config/v1';
const id=process.env.ROTATION_PROBE_ID;
const cutoff=process.env.ROTATION_SESSION_CUTOFF;
if(!id||!cutoff)throw new Error('Explicit non-secret probe id and session cutoff required');
// No credential values: all protected variables are preserved server-side.
export default defineConfig({functions:{settlement:{name:'Elite auction settlement',source:'./apps/api/src/settlement/function.ts',env:{FINANCIAL_MAINTENANCE:'true',ROTATION_PROBE_ID:id,ROTATION_SESSION_CUTOFF:cutoff}}}});
