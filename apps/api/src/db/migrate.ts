import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { env, projectRoot } from '../config.js';
if(process.env.AUDIT_RECOVERY_MODE==='true'){console.log('Audit recovery: migrations skipped.');process.exit(0);}
const pool = new pg.Pool({connectionString:env.DATABASE_URL});
const client = await pool.connect();
try {
  await client.query("SELECT pg_advisory_lock(783206261)");
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const folder = join(projectRoot,'apps/api/migrations');
  for (const name of (await readdir(folder)).filter(n=>n.endsWith('.sql')).sort()) {
    const sql = await readFile(`${folder}/${name}`,'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const existing = await client.query<{checksum:string}>('SELECT checksum FROM schema_migrations WHERE name=$1',[name]);
    if(existing.rows[0]) {
      if(existing.rows[0].checksum !== checksum) throw new Error(`Migration alterada: ${name}`);
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);
      await client.query('COMMIT');
      console.log(`Aplicada: ${name}`);
    } catch(error) {await client.query('ROLLBACK'); throw error;}
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(783206261)');
  client.release(); await pool.end();
}
