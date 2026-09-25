// Assigns each category in src/data/minefield_categories.json a calendar day
// and writes src/data/minefield_daily.json — the seed data for the
// minefield_challenges table (Minefield's day-picker, mirroring Daily Top 10).
//
// Idempotent by id: a category already present in the existing
// minefield_daily.json keeps its already-assigned date (never re-dated, since
// that date may already be seeded/insert-only in Supabase). Only categories
// not yet dated get new dates, continuing the day after the latest existing
// date (or START_DATE if minefield_daily.json doesn't exist yet).
//
// Deliberately does NOT repeat categories to fill all 16 day-picker slots:
// with only N categories, only N days get real content and the rest are
// left for the UI to grey out (per the "don't have 16 yet" instruction).
// Re-run this after minefield_categories.json grows with more categories:
//   node scripts/generate-minefield-daily.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const START_DATE = '2026-09-14' // same launch date as daily_top10.json, used only if minefield_daily.json doesn't exist yet

const categories = JSON.parse(readFileSync(path.join(__dirname, '../src/data/minefield_categories.json'), 'utf8'))
const outPath = path.join(__dirname, '../src/data/minefield_daily.json')
const existing = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : []
const existingByTitle = new Map(existing.map((d) => [d.title, d.date]))

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const nextFreeDate = existing.length ? addDays(existing[existing.length - 1].date, 1) : START_DATE
let nextIndex = 0

const days = categories.map((c) => ({
  date: existingByTitle.get(c.title) ?? addDays(nextFreeDate, nextIndex++),
  title: c.title,
  criteria_description: c.criteria_description ?? null,
  tiles: c.tiles,
  source: c.source ?? null,
  verified_date: c.verified_date ?? null,
}))

writeFileSync(outPath, JSON.stringify(days, null, 2) + '\n')
console.log(`Wrote ${days.length} dated Minefield challenges (${days[0]?.date} -> ${days[days.length - 1]?.date}) to ${outPath}`)
