// Seeds/updates the minefield_challenges table from src/data/minefield_daily.json.
// Uses the SERVICE ROLE key deliberately: the table has no client-facing insert
// policy (see supabase/schema.sql — future days must never be readable before
// their date, so only a trusted server-side key may write rows at all).
//
// Safe to re-run: upserts by primary key `date`.
//
// Usage:
//   SUPABASE_URL="https://[ref].supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="..." \
//     node scripts/seed-minefield-challenges.mjs
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

const days = JSON.parse(readFileSync(path.join(__dirname, '../src/data/minefield_daily.json'), 'utf8'))

const supabase = createClient(supabaseUrl, serviceRoleKey)

const rows = days.map((d) => ({
  date: d.date,
  title: d.title,
  criteria_description: d.criteria_description,
  tiles: d.tiles,
  source: d.source,
  verified_date: d.verified_date,
}))

const { data, error } = await supabase.from('minefield_challenges').upsert(rows, { onConflict: 'date' }).select('date')

if (error) {
  console.error('Seed failed:', error.message)
  process.exit(1)
}

console.log(`Seeded/updated ${data.length} minefield_challenges rows: ${data.map((r) => r.date).join(', ')}`)
