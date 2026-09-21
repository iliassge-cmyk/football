// Automated-cron variant of seed-daily-challenges.mjs.
//
// The manual script (`npm run db:seed-daily`) upserts by date - correct for
// hand-fixing a typo before a day goes live, but wrong for an unattended
// schedule: if a past day's JSON entry were ever edited, a blind upsert
// would silently change an answer that users have already played and been
// scored against (see daily_attempts - is_ranked/points are locked in at
// attempt time, but the *displayed* entries would retroactively disagree
// with what was actually asked).
//
// This variant only ever INSERTS dates that don't exist yet in the table
// (`ignoreDuplicates: true`). A day, once seeded, is immutable from here on -
// exactly the "snapshot at generation time, never changes after" behaviour
// the ranked modes need. To intentionally correct an already-seeded day, use
// the manual `npm run db:seed-daily` (or the SQL Editor) instead - that's a
// deliberate human decision, not something a schedule should ever do.
//
// Usage (same env vars as the manual script):
//   SUPABASE_URL="https://[ref].supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="..." \
//     node scripts/seed-daily-challenges-safe.mjs
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

const { data, error } = await supabase
  .from('daily_challenges')
  .upsert(rows, { onConflict: 'date', ignoreDuplicates: true })
  .select('date')

if (error) {
  console.error('Seed failed:', error.message)
  process.exit(1)
}

// PostgREST only returns the rows it actually inserted when ignoreDuplicates
// is set (already-existing dates come back empty, not as an error).
console.log(`Inserted ${data.length} new daily_challenges row(s): ${data.map((r) => r.date).join(', ') || '(none - all dates already existed)'}`)
