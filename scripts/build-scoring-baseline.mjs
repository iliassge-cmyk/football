// Builds data/extended/scoring_baseline.json: per player, club goals and assists per season plus the national-team
// totals, taken from the one-time Footballdatabase export (exports/fbd_all.json). This is the history behind
// `career_goals` / `career_assists` in players.json.
//
// scripts/refresh-scoring.mjs then re-reads the newest two seasons from FotMob every week and replaces just those
// seasons, so   career = Footballdatabase history + live recent seasons (+ national team).
//
// Club numbers = league + continental + cup competitions of every club the player was at (incl. youth/reserve sides).
// National team = senior caps from the Footballdatabase profile seasons ("Länderspiele"), kept apart from the club
// seasons so the live refresh can swap them for FotMob's current national-team total.
//
// Usage: node scripts/build-scoring-baseline.mjs [exports/fbd_all.json]
//   Also writes the initial career_goals / career_assists into players.json (pass --no-apply to skip that).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const APPLY = !args.includes('--no-apply')
const exportFile = args.find((a) => !a.startsWith('--')) || path.join(__dirname, '../exports/fbd_all.json')
const OUT = path.join(__dirname, '../data/extended/scoring_baseline.json')
const PLAYERS_PATH = path.join(__dirname, '../src/data/players.json')

const players = JSON.parse(readFileSync(PLAYERS_PATH, 'utf8'))
const data = JSON.parse(readFileSync(exportFile, 'utf8'))
const byName = new Map(data.results.map((r) => [r.profile.inGameName, r]))
const isRetired = (p) => /\(retired\)\s*$/i.test(p.club || '')

const out = {}
const missing = []
for (const p of players) {
  const r = byName.get(p.name)
  if (!r) {
    missing.push(p.name)
    continue
  }
  const seasons = {}
  let natGoals = 0
  let natAssists = 0
  for (const s of r.seasons) {
    const e = (seasons[s.season] ||= [0, 0])
    e[0] += s.goals ?? 0
    e[1] += s.assists ?? 0
    natGoals += s.nationalGoals ?? 0
    natAssists += s.nationalAssists ?? 0
  }
  out[p.id] = { name: p.name, fbdId: r.profile.fbdId, retired: isRetired(p), seasons, national: [natGoals, natAssists] }
}

const total = (e) => [
  Object.values(e.seasons).reduce((a, s) => a + s[0], 0) + e.national[0],
  Object.values(e.seasons).reduce((a, s) => a + s[1], 0) + e.national[1],
]

mkdirSync(path.dirname(OUT), { recursive: true })
// one player per line keeps the file diffable without ballooning
const lines = Object.entries(out).map(([id, e]) => `${JSON.stringify(id)}:${JSON.stringify(e)}`)
writeFileSync(
  OUT,
  `{"source":"footballdatabase.eu export","exportedAt":${JSON.stringify(data.updatedAt ?? null)},"players":{\n${lines.join(',\n')}\n}}\n`
)
console.log(`Wrote ${Object.keys(out).length} players to ${OUT}`)
if (missing.length) console.log(`No Footballdatabase data for ${missing.length}: ${missing.join(', ')}`)

if (APPLY) {
  // The baseline is the historical value. Retired players are never refreshed afterwards, so their value is simply
  // this one; active players get the weekly FotMob top-up on top (refresh-scoring.mjs). --retired-only leaves active
  // players alone (use it to re-apply the baseline without discarding their live values).
  const retiredOnly = args.includes('--retired-only')
  let changed = 0
  let applied = 0
  for (const p of players) {
    const e = out[p.id]
    if (!e || (retiredOnly && !isRetired(p))) continue
    const [g, a] = total(e)
    if (p.career_goals !== g || p.career_assists !== a) changed++
    p.career_goals = g
    p.career_assists = a
    applied++
  }
  writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2) + '\n')
  console.log(`players.json: career_goals / career_assists set from the baseline for ${applied} players (${changed} changed).`)
}
