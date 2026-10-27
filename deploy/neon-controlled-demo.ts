import { defineConfig } from '@neon/config/v1';
const session=process.env.CONTROLLED_DEMO_SESSION_HASH,until=process.env.CONTROLLED_DEMO_UNTIL;
if(!session||!until||!/^[a-f0-9]{64}$/.test(session)||!Number.isFinite(Date.parse(until)))throw new Error('Explicit session hash and expiry required');
// Only a hash of one dedicated application session is sent, never a credential.
// Existing protected SQL/Blob/signing values are preserved by omission.
export default defineConfig({functions:{settlement:{name:'Elite auction settlement',source:'./apps/api/src/settlement/controlled-function.ts',env:{FINANCIAL_MAINTENANCE:'true',CONTROLLED_DEMO_SESSION_HASH:session,CONTROLLED_DEMO_UNTIL:until}}}});
