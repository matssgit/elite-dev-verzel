import pg from 'pg';
import { readFile,writeFile } from 'node:fs/promises';
import process from 'node:process';
import console from 'node:console';
import assert from 'node:assert/strict';
const evidence=JSON.parse(await readFile('tmp/production-evidence.json','utf8'));
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});
const client=await pool.connect();
try {
  await client.query('BEGIN READ ONLY');
  const ids=[evidence.main,...evidence.concurrentLots,evidence.idleLot];
  const lots=(await client.query('SELECT id,ends_at,settled_at,current_cents,bid_count FROM auctions WHERE id=ANY($1::uuid[]) ORDER BY ends_at',[ids])).rows;
  const receipts=(await client.query('SELECT id,auction_id,amount_cents,ended_at,settled_at FROM receipts WHERE auction_id=ANY($1::uuid[])',[ids])).rows;
  const entries=(await client.query('SELECT auction_id,kind,count(*)::int AS count,sum(amount_cents)::text AS amount FROM wallet_entries WHERE auction_id=ANY($1::uuid[]) GROUP BY auction_id,kind',[ids])).rows;
  const reserves=(await client.query('SELECT w.user_id,w.committed_cents::text,COALESCE(sum(a.current_cents),0)::text AS expected FROM wallets w LEFT JOIN auctions a ON a.leader_id=w.user_id AND a.settled_at IS NULL AND a.cancelled_at IS NULL WHERE w.user_id=ANY($1::uuid[]) GROUP BY w.user_id,w.committed_cents',[evidence.accounts.map(a=>a.user.id)])).rows;
  for(const row of reserves)assert.equal(row.committed_cents,row.expected);
  for(const lot of lots)if(lot.settled_at&&lot.current_cents!==null){assert.equal(receipts.filter(r=>r.auction_id===lot.id).length,1);const pair=entries.filter(e=>e.auction_id===lot.id);assert.equal(pair.length,2);assert.equal(pair.reduce((s,e)=>s+Number(e.amount),0),0);for(const entry of pair)assert.equal(entry.count,1);}
  const privilege=(await client.query("SELECT current_user,pg_has_role(current_user,'pg_read_server_files','member') AS can_read_server_files")).rows[0];
  assert.equal(privilege.can_read_server_files,false);
  await client.query('COMMIT');
  const result={checkedAt:new Date().toISOString(),lots,receipts,entries,reserves,privilege};
  await writeFile('tmp/production-readonly.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{client.release();await pool.end();}
