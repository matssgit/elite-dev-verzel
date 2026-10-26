import { it,expect,vi,afterEach } from 'vitest';
const connect=vi.hoisted(()=>vi.fn(()=>{throw new Error('Must not open a DB connection');}));
vi.mock('../src/db/client.js',()=>({connect}));
import handler from '../src/settlement/function.js';
afterEach(()=>{vi.unstubAllEnvs();connect.mockClear();});
it('rejects anonymous POST before connecting to the database',async()=>{
  expect((await handler.fetch(new Request('https://function.test/',{method:'POST'}))).status).toBe(403);
  expect(connect).not.toHaveBeenCalled();
});
it('maintenance stops even a scheduled invocation before opening a transaction',async()=>{
  vi.stubEnv('FINANCIAL_MAINTENANCE','true');
  const response=await handler.fetch(new Request('https://function.test/',{method:'POST',headers:{'x-neon-trigger-invocation-id':'local-fixture'}}));
  expect(response.status).toBe(503);expect(await response.json()).toMatchObject({maintenance:true});
  expect(connect).not.toHaveBeenCalled();
});
