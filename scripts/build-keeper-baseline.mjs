// Builds data/extended/keeper_baseline.json: per goalkeeper, clean sheets per season (club competitions only)
// taken from the one-time Footballdatabase export. refresh-clean-sheets.mjs then overrides only the newest two
// seasons with fresh FotMob numbers every week, so the career total = this frozen history + live recent seasons.
//
// Usage: node scripts/build-keeper-baseline.mjs [exports/fbd_all.json]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const exportFile = process.argv[2] || path.join(__dirname, '../exports/fbd_all.json')
const OUT = path.join(__dirname, '../data/extended/keeper_baseline.json')

const players = JSON.parse(readFileSync(path.join(__dirname, '../src/data/players.json'), 'utf8'))
const data = JSON.parse(readFileSync(exportFile, 'utf8'))
const isGoalkeeper = (p) => /keeper|goalkeeper|\bgk\b/i.test(p.position || '')
const isRetired = (p) => /\(retired\)\s*$/i.test(p.club || '')

const byName = new Map(data.results.map((r) => [r.profile.inGameName, r]))
const keepers = {}
let missing = []
for (const p of players.filter((x) => isGoalkeeper(x) && !isRetired(x))) {
  const r = byName.get(p.name)
  if (!r) {
    missing.push(p.name)
    continue
  }
  const seasons = {}
  for (const s of r.seasons) {
    const e = (seasons[s.season] ||= { cleanSheets: 0, goalsAgainst: 0, games: 0 })
    e.cleanSheets += s.cleanSheets ?? 0
    e.goalsAgainst += s.goalsAgainst ?? 0
    e.games += s.games ?? 0
  }
  keepers[p.id] = { name: p.name, fbdId: r.profile.fbdId, pageName: r.profile.pageName, seasons }
}

mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(
  OUT,
  JSON.stringify({ source: 'footballdatabase.eu export', exportedAt: data.updatedAt ?? null, keepers }, null, 2) + '\n'
)
console.log(`Wrote ${Object.keys(keepers).length} goalkeepers to ${OUT}`)
if (missing.length) console.log(`No Footballdatabase data for ${missing.length}: ${missing.join(', ')}`)
