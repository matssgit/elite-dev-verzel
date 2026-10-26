import { defineConfig } from '@neon/config/v1';

const enabled=process.env.FINANCIAL_MAINTENANCE;
if(enabled!=='true'&&enabled!=='false')throw new Error('Explicit FINANCIAL_MAINTENANCE=true or false required');
// No credentials are transferred: all other deployed keys remain unchanged.
export default defineConfig({functions:{settlement:{
  name:'Elite auction settlement',source:'./apps/api/src/settlement/function.ts',
  env:{FINANCIAL_MAINTENANCE:enabled},
}}});
