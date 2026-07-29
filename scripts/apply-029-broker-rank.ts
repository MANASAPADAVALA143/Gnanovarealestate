/**
 * Apply 029 via direct Postgres when DATABASE_URL is set.
 * Otherwise exits with instructions to paste SQL in Supabase SQL Editor.
 *
 *   set DATABASE_URL=postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres
 *   npx tsx scripts/apply-029-broker-rank.ts
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function columnsExist(): Promise<boolean> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return false
  const sb = createClient(url, key)
  const { error } = await sb.from('agents').select('broker_rank_score').limit(1)
  if (!error) return true
  // PGRST204 = column not in schema cache; 42703 similar
  console.log('Column check:', error.message, error.code)
  return false
}

async function applyViaPg(sql: string) {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (!dbUrl) return false
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(sql)
    console.log('Applied 029 via DATABASE_URL')
    return true
  } finally {
    await client.end()
  }
}

async function main() {
  if (await columnsExist()) {
    console.log('029 already applied (broker_rank_score exists)')
    return
  }

  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '029_broker_rank.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  try {
    const ok = await applyViaPg(sql)
    if (ok) return
  } catch (e) {
    console.error('DATABASE_URL apply failed:', e instanceof Error ? e.message : e)
  }

  console.error(`
Cannot run DDL without a Postgres connection string.

1) Open Supabase → SQL Editor
2) Paste and Run the full file:
   supabase/migrations/029_broker_rank.sql
3) Reply here when it shows Success

Or set DATABASE_URL to your Supabase Postgres URI and re-run:
   npx tsx scripts/apply-029-broker-rank.ts
`)
  process.exit(2)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
