import { defineConfig } from '@neon/config/v1';
// Cryptographic activation only. All protected settings remain server-side;
// financial maintenance and disabled jobs are mandatory throughout validation.
export default defineConfig({functions:{settlement:{name:'Elite auction settlement',source:'./apps/api/src/settlement/function.ts',env:{FINANCIAL_MAINTENANCE:'true',AUDIT_RECOVERY_MODE:'false',RUN_SETTLEMENT_JOBS:'false'}}}});
