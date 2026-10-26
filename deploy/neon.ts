import { defineConfig } from '@neon/config/v1';
// Configure the existing branch only; no database/auth/storage replacements.
export default defineConfig({functions:{settlement:{name:'Elite auction settlement',source:'./apps/api/src/settlement/function.ts',env:{
  NODE_ENV:'production',AUDIT_STORAGE:'blob',AUDIT_BLOB_PREFIX:'elite-v1/',
  BLOB_READ_WRITE_TOKEN:process.env.BLOB_READ_WRITE_TOKEN!,
  AUDIT_PRIVATE_KEY:process.env.AUDIT_PRIVATE_KEY!,
  AUDIT_PUBLIC_KEY_FINGERPRINT:process.env.AUDIT_PUBLIC_KEY_FINGERPRINT!,
  FINANCIAL_MAINTENANCE:process.env.FINANCIAL_MAINTENANCE??'false',
}}}});
