// One-time (or repeatable — everything is CREATE ... IF NOT EXISTS / CREATE OR REPLACE)
// setup script: applies supabase/schema.sql directly against the project's Postgres
// database. Needs the *direct* database connection string, not the API URL/anon key —
// get it from Supabase dashboard: Project Settings -> Database -> Connection string (URI).
//
// Usage:
//   DATABASE_URL="postgres://postgres:[password]@db.[ref].supabase.co:5432/postgres" \
//     node scripts/apply-schema.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('Set DATABASE_URL to your Supabase project\'s direct Postgres connection string.')
  process.exit(1)
}

const sql = readFileSync(path.join(__dirname, '../supabase/schema.sql'), 'utf8')

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query(sql)
  console.log('Schema applied successfully.')
} finally {
  await client.end()
}
