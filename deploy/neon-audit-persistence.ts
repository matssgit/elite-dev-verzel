import { defineConfig } from '@neon/config/v1';
// After first activation only: refuse missing remote artifacts instead of
// recreating them during the redeploy persistence test. No secret transport.
export default defineConfig({functions:{settlement:{name:'Elite auction settlement',source:'./apps/api/src/settlement/function.ts',env:{SCHEDULED_VALIDATION_ENABLED:'false',SCHEDULED_VALIDATION_SESSION_HASH:'',FINANCIAL_MAINTENANCE:'true',AUDIT_RECOVERY_MODE:'false',RUN_SETTLEMENT_JOBS:'false',AUDIT_REQUIRE_EXISTING_TRANSITION:'true',AUDIT_REQUIRE_EXISTING_SIGNING_PROOF:'true'}}}});
