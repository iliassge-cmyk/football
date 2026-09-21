// Automated-cron variant of seed-minefield-challenges.mjs — see
// seed-daily-challenges-safe.mjs for the full rationale (insert-only,
// never overwrites an already-seeded date). Regenerates minefield_daily.json
// from minefield_categories.json first so a newly-added category gets
// assigned the next free day automatically, without needing that
// intermediate file committed to the repo (it's seed-only input, per the
// README - "NOT imported by the frontend bundle").
//
// Usage:
//   SUPABASE_URL="https://[ref].supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="..." \
//     node scripts/seed-minefield-challenges-safe.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

// Regenerate minefield_daily.json from the current minefield_categories.json
// so any newly-added category is included before we seed.
execFileSync('node', [path.join(__dirname, 'generate-minefield-daily.mjs')], { stdio: 'inherit' })

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

const { data, error } = await supabase
  .from('minefield_challenges')
  .upsert(rows, { onConflict: 'date', ignoreDuplicates: true })
  .select('date')

if (error) {
  console.error('Seed failed:', error.message)
  process.exit(1)
}

console.log(`Inserted ${data.length} new minefield_challenges row(s): ${data.map((r) => r.date).join(', ') || '(none - all dates already existed)'}`)
