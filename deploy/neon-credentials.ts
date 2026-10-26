import { defineConfig } from '@neon/config/v1';

// Existing function only. Omitted environment keys preserve deployed values;
// in particular, this operation never supplies/replaces the audit signing key.
export default defineConfig({functions:{settlement:{
  name:'Elite auction settlement',
  source:'./apps/api/src/settlement/function.ts',
  env:{
    DATABASE_URL:process.env.DATABASE_URL!,
    DATABASE_URL_UNPOOLED:process.env.DATABASE_URL!,
    BLOB_READ_WRITE_TOKEN:process.env.BLOB_READ_WRITE_TOKEN!,
    FINANCIAL_MAINTENANCE:'true',
  },
}}});
