import { defineConfig } from '@neon/config/v1';
const run=process.env.SCHEDULED_VALIDATION_RUN_ID,hash=process.env.SCHEDULED_VALIDATION_SESSION_HASH,until=process.env.SCHEDULED_DIAGNOSTIC_UNTIL;
if(!run||!hash||!/^[a-f0-9]{64}$/.test(hash)||!until||!Number.isFinite(Date.parse(until)))throw Error('Explicit temporary diagnostic binding required');
export default defineConfig({functions:{settlement:{name:'Elite auction settlement',source:'./apps/api/src/settlement/neutral-function.ts',env:{
  SCHEDULED_VALIDATION_RUN_ID:run,SCHEDULED_VALIDATION_SESSION_HASH:hash,SCHEDULED_DIAGNOSTIC_UNTIL:until,
  SCHEDULED_VALIDATION_ENABLED:'false',SCHEDULED_VALIDATION_AUCTION_ID:'',SCHEDULED_VALIDATION_BUYER_ID:'',SCHEDULED_VALIDATION_SELLER_ID:'',
  SCHEDULED_VALIDATION_EXPECTED_BUILD:'',
  FINANCIAL_MAINTENANCE:'true',AUDIT_RECOVERY_MODE:'false',RUN_SETTLEMENT_JOBS:'false',AUDIT_REQUIRE_EXISTING_TRANSITION:'true',AUDIT_REQUIRE_EXISTING_SIGNING_PROOF:'true',
}}}});
