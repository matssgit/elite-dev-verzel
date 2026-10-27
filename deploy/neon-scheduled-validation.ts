import { defineConfig } from '@neon/config/v1';
const names=['RUN_ID','SESSION_HASH','AUCTION_ID','BUYER_ID','SELLER_ID','ENABLED'] as const;
const binding=Object.fromEntries(names.map(name=>[`SCHEDULED_VALIDATION_${name}`,process.env[`SCHEDULED_VALIDATION_${name}`]??'']));
// Only public UUIDs, booleans and a one-way application-session hash are sent.
// Existing private provider variables remain in Neon; no env pull or secret IO.
export default defineConfig({functions:{settlement:{name:'Elite auction settlement',source:'./apps/api/src/settlement/scheduled-function.ts',env:{...binding,FINANCIAL_MAINTENANCE:'true',AUDIT_RECOVERY_MODE:'false',RUN_SETTLEMENT_JOBS:'false',AUDIT_REQUIRE_EXISTING_TRANSITION:'true',AUDIT_REQUIRE_EXISTING_SIGNING_PROOF:'true'}}}});
