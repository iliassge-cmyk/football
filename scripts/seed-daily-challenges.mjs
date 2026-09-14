// Seeds/updates the daily_challenges table from src/data/daily_top10.json.
// Uses the SERVICE ROLE key deliberately: the table has no client-facing insert
// policy (see supabase/schema.sql — future days must never be readable before
// their date, so only a trusted server-side key may write rows at all).
//
// Safe to re-run: upserts by primary key `date`, so running it again after the
// dataset grows (more days added) just adds/updates rows, never duplicates.
//
// Usage:
//   SUPABASE_URL="https://[ref].supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="..." \
//     node scripts/seed-daily-challenges.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const days = JSON.parse(readFileSync(path.join(__dirname, '../src/data/daily_top10.json'), 'utf8'))

const supabase = createClient(supabaseUrl, serviceRoleKey)

const rows = days.map((d) => ({
  date: d.date,
  title: d.title,
  entries: d.entries,
  source_primary: d.source_primary,
  source_secondary: d.source_secondary,
  verified_date: d.verified_date,
}))

const { data, error } = await supabase.from('daily_challenges').upsert(rows, { onConflict: 'date' }).select('date')

if (error) {
  console.error('Seed failed:', error.message)
  process.exit(1)
}

console.log(`Seeded/updated ${data.length} daily_challenges rows: ${data.map((r) => r.date).join(', ')}`)
