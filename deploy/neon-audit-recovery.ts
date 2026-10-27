import { defineConfig } from '@neon/config/v1';
// No credential values: preserve all protected/current audit settings for diagnosis.
export default defineConfig({functions:{settlement:{name:'Elite auction settlement',source:'./apps/api/src/settlement/function.ts',env:{FINANCIAL_MAINTENANCE:'true',AUDIT_RECOVERY_MODE:'true',RUN_SETTLEMENT_JOBS:'false'}}}});
