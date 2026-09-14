// Assigns each category in src/data/minefield_categories.json to one
// consecutive calendar day, starting from START_DATE, and writes
// src/data/minefield_daily.json — the seed data for the minefield_challenges
// table (Minefield's day-picker, mirroring Daily Top 10).
//
// Deliberately does NOT repeat categories to fill all 16 day-picker slots:
// with only N categories, only N days get real content and the rest are
// left for the UI to grey out (per the "don't have 16 yet" instruction).
// Re-run this after minefield_categories.json grows with more categories:
//   node scripts/generate-minefield-daily.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const START_DATE = '2026-09-14' // same launch date as daily_top10.json

const categories = JSON.parse(readFileSync(path.join(__dirname, '../src/data/minefield_categories.json'), 'utf8'))

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const days = categories.map((c, i) => ({
  date: addDays(START_DATE, i),
  title: c.title,
  criteria_description: c.criteria_description ?? null,
  tiles: c.tiles,
  source: c.source ?? null,
  verified_date: c.verified_date ?? null,
}))

const outPath = path.join(__dirname, '../src/data/minefield_daily.json')
writeFileSync(outPath, JSON.stringify(days, null, 2) + '\n')
console.log(`Wrote ${days.length} dated Minefield challenges (${days[0]?.date} -> ${days[days.length - 1]?.date}) to ${outPath}`)
