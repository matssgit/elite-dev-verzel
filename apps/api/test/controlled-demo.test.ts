import { afterEach,it,expect,vi } from 'vitest';
import { controlledDemo, DEMO_LOT, verifyDemoDelta } from '../src/settlement/controlled-demo.js';

afterEach(()=>vi.unstubAllEnvs());
const fixture=()=>{
  const before={wallets:[{user_id:'buyer',total_cents:10000,committed_cents:5000},{user_id:'seller',total_cents:100,committed_cents:0},{user_id:'other',total_cents:300,committed_cents:0}],wallet_entries:[],receipts:[],bids:[{id:'bid'}],auctions:[{id:DEMO_LOT,settled_at:null}],audit_records:[{auction_id:DEMO_LOT,sequence:0,payload:{type:'OPEN'},published_at:'old'},{auction_id:DEMO_LOT,sequence:1,payload:{type:'BID'},published_at:'old'}]};
  const after=structuredClone(before) as Parameters<typeof verifyDemoDelta>[1];
  after.wallets[0]!.total_cents=5000;after.wallets[0]!.committed_cents=0;after.wallets[1]!.total_cents=5100;after.auctions[0]!.settled_at='now';
  after.wallet_entries=[{auction_id:DEMO_LOT,kind:'PURCHASE',user_id:'buyer',amount_cents:-5000},{auction_id:DEMO_LOT,kind:'SALE',user_id:'seller',amount_cents:5000}];
  after.receipts=[{id:'receipt',auction_id:DEMO_LOT,winner_id:'buyer',amount_cents:5000}];
  after.audit_records.push({auction_id:DEMO_LOT,sequence:2,payload:{type:'SETTLE'},published_at:'now'});return {before,after};
};
it('accepts exactly one simulated purchase/sale with reserve release and one new anchor',()=>{
  const {before,after}=fixture();expect(verifyDemoDelta(before,after,'buyer','seller')).toMatchObject({ledgerEntries:2,receiptId:'receipt',unexpectedFinancialChanges:false,buyer:{debitCents:5000,afterReserved:0},seller:{creditCents:5000}});
});
it.each(['other-wallet','extra-ledger','changed-bid','old-checkpoint','extra-receipt','wrong-credit','extra-lot'])('rejects an unexpected financial change: %s',change=>{
  const {before,after}=fixture();
  if(change==='other-wallet')after.wallets[2]!.total_cents=301;
  if(change==='extra-ledger')after.wallet_entries.push({auction_id:'other',kind:'SALE',amount_cents:1});
  if(change==='changed-bid')after.bids[0]!.id='changed';
  if(change==='old-checkpoint')after.audit_records[0]!.published_at='changed';
  if(change==='extra-receipt')after.receipts.push({...after.receipts[0]!,id:'duplicate'});
  if(change==='wrong-credit')after.wallets[1]!.total_cents=5101;
  if(change==='extra-lot')after.auctions.push({id:'other'});
  expect(()=>verifyDemoDelta(before,after,'buyer','seller')).toThrow();
});
it('has no maintenance bypass outside the explicit operator window',async()=>{
  vi.stubEnv('FINANCIAL_MAINTENANCE','false');expect((await controlledDemo(new Request('https://fixture/controlled-demo-settlement',{method:'POST'}))).status).toBe(404);
  vi.stubEnv('FINANCIAL_MAINTENANCE','true');vi.stubEnv('CONTROLLED_DEMO_SESSION_HASH','a'.repeat(64));vi.stubEnv('CONTROLLED_DEMO_UNTIL','2000-01-01T00:00:00Z');
  expect((await controlledDemo(new Request('https://fixture/controlled-demo-settlement',{method:'POST'}))).status).toBe(404);
});
it('rejects missing/wrong session before connecting and refuses GET',async()=>{
  vi.stubEnv('FINANCIAL_MAINTENANCE','true');vi.stubEnv('CONTROLLED_DEMO_SESSION_HASH','a'.repeat(64));vi.stubEnv('CONTROLLED_DEMO_UNTIL',new Date(Date.now()+60000).toISOString());
  expect((await controlledDemo(new Request('https://fixture/controlled-demo-settlement'))).status).toBe(405);
  expect((await controlledDemo(new Request('https://fixture/controlled-demo-settlement',{method:'POST'}))).status).toBe(403);
});
