// Football Bingo: builds the daily 3x3 grids (3 categories on top, 3 on the left) into src/data/bingo_daily.json.
// A category is a club the player was at, a nationality, or a title he won (all from src/data/players.json: clubs, nationality, titles).
// Every grid is checked: each of the 9 cells has at least MIN_SOLUTIONS footballers (the data of the sync decide, not the date).
//   node scripts/build-bingo.mjs [--days 60] [--from 2026-10-31] [--stats]
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const val = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d)
const DAYS = Number(val('--days', '60'))
const FROM = val('--from', '2026-10-31')
const MIN_SOLUTIONS = 3 // every cell needs at least this many footballers
const MIN_CLUB = 15, MIN_NAT = 20, MIN_TITLE = 25 // a category must be held by this many footballers to be used at all

const players = JSON.parse(readFileSync(`${R}/src/data/players.json`, 'utf8')).filter((p) => Array.isArray(p.clubs) && p.clubs.length)
const clubs = JSON.parse(readFileSync(`${R}/src/data/clubs.json`, 'utf8'))
const TITLES = JSON.parse(readFileSync(`${R}/marketing/tm-title-keys.json`, 'utf8'))

const TITLE_LABEL = {
  'UEFA Champions League winner': 'Champions League winner', 'Europa League winner': 'Europa League winner', 'Uefa Cup winner': 'UEFA Cup winner', 'Conference League winner': 'Conference League winner',
  'Uefa Supercup winner': 'UEFA Super Cup winner', 'FIFA Club World Cup winner': 'Club World Cup winner', 'Intercontinental Cup winner': 'Intercontinental Cup winner', 'FIFA Intercontinental Cup Winner': 'Intercontinental Cup winner',
  'Copa Libertadores winner': 'Copa Libertadores winner', 'English Champion': 'Premier League champion', 'Spanish champion': 'La Liga champion', 'Italian champion': 'Serie A champion', 'German Champion': 'Bundesliga champion',
  'French champion': 'Ligue 1 champion', 'Dutch champion': 'Eredivisie champion', 'Portuguese champion': 'Primeira Liga champion', 'Brazilian champion': 'Brazilian champion', 'Belgian champion': 'Belgian champion',
  'Turkish champion': 'Turkish champion', 'Argentinian champion': 'Argentinian champion', 'English FA Cup winner': 'FA Cup winner', 'English League Cup winner': 'League Cup winner', 'Spanish cup winner': 'Copa del Rey winner',
  'German cup winner': 'DFB-Pokal winner', 'Italian cup winner': 'Coppa Italia winner', 'French cup winner': 'Coupe de France winner', 'Dutch Cup winner': 'KNVB Cup winner', 'Portuguese cup winner': 'Taça de Portugal winner',
  'English Super Cup winner': 'Community Shield winner', 'Spanish Super Cup winner': 'Supercopa de España winner', 'Italian Super Cup winner': 'Supercoppa Italiana winner', 'German Super Cup winner': 'German Super Cup winner',
  'French Super Cup winner': 'Trophée des Champions winner', 'World Cup winner': 'World Cup winner', 'European champion': 'European champion', 'Copa América winner': 'Copa América winner', 'Winner UEFA Nations League': 'Nations League winner',
  'Confederations Cup winner': 'Confederations Cup winner', 'Africa Cup winner': 'Africa Cup winner', "Winner Ballon d'Or": "Ballon d'Or winner",
}
// the same title under two Transfermarkt names counts as one category
const TITLE_GROUP = { 'Uefa Cup winner': 'Europa League winner', 'FIFA Intercontinental Cup Winner': 'Intercontinental Cup winner' }
const titleKeys = TITLES.filter((k) => !(k in TITLE_GROUP))
const hasTitle = (p, k) => (p.titles?.[k] ?? 0) > 0 || (p.titles?.[Object.keys(TITLE_GROUP).find((x) => TITLE_GROUP[x] === k)] ?? 0) > 0

const cats = []
for (const c of clubs) {
  if (c.reserve || c.type === 'national_team') continue
  const n = players.filter((p) => p.clubs.includes(c.id)).length
  if (n >= MIN_CLUB) cats.push({ type: 'club', key: c.id, label: c.name, n, test: (p) => p.clubs.includes(c.id) })
}
const natCount = {}
for (const p of players) if (p.nationality) natCount[p.nationality] = (natCount[p.nationality] ?? 0) + 1
for (const [nat, n] of Object.entries(natCount)) if (n >= MIN_NAT) cats.push({ type: 'nat', key: nat, label: nat, n, test: (p) => p.nationality === nat })
for (const k of titleKeys) {
  const n = players.filter((p) => hasTitle(p, k)).length
  if (n >= MIN_TITLE) cats.push({ type: 'title', key: k, label: TITLE_LABEL[k] ?? k, n, test: (p) => hasTitle(p, k) })
}
const solutions = (a, b) => players.filter((p) => a.test(p) && b.test(p)).length
if (has('--stats')) {
  console.log(`categories: ${cats.filter((c) => c.type === 'club').length} clubs, ${cats.filter((c) => c.type === 'nat').length} nationalities, ${cats.filter((c) => c.type === 'title').length} titles (of ${titleKeys.length})`)
  console.log('titles:', cats.filter((c) => c.type === 'title').map((c) => `${c.label} ${c.n}`).join(' | '))
  console.log('nationalities:', cats.filter((c) => c.type === 'nat').map((c) => `${c.key} ${c.n}`).join(' | '))
  console.log('clubs (top 40):', cats.filter((c) => c.type === 'club').sort((a, b) => b.n - a.n).slice(0, 40).map((c) => `${c.label} ${c.n}`).join(' | '))
}
function has(f) { return args.includes(f) }

function rng(seed) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296 }
}
// bigger categories are drawn more often (their cells are more likely to have solutions), small ones still appear now and then
const pick = (arr, r) => { const w = arr.map((c) => Math.sqrt(c.n)); let x = r() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < arr.length; i++) { x -= w[i]; if (x <= 0) return arr[i] } return arr[arr.length - 1] }
const dayAfter = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10)

const out = []
const recent = [] // categories of the last 3 days are not used again (variety)
for (let i = 0; i < DAYS; i++) {
  const date = dayAfter(FROM, i)
  const r = rng('bingo-' + date)
  const banned = new Set(recent.flat())
  const pool = cats.filter((c) => !banned.has(c.key))
  let grid = null
  for (let attempt = 0; attempt < 30000 && !grid; attempt++) {
    // 3 columns + 3 rows; at most one nationality per side and at least one club or title on each side, so a nationality never meets another nationality
    const cols = [pick(pool, r), pick(pool, r), pick(pool, r)]
    const rows = [pick(pool, r), pick(pool, r), pick(pool, r)]
    const all = [...cols, ...rows]
    if (new Set(all.map((c) => c.key)).size < 6) continue
    if (cols.filter((c) => c.type === 'nat').length > 1 || rows.filter((c) => c.type === 'nat').length > 1) continue
    if (all.filter((c) => c.type === 'title').length > 3) continue
    const cells = rows.map((row) => cols.map((col) => solutions(row, col)))
    if (cells.flat().some((n) => n < MIN_SOLUTIONS)) continue
    grid = { cols, rows, cells }
  }
  if (!grid) { console.error(`no valid grid for ${date}`); continue }
  recent.push(grid.cols.concat(grid.rows).map((c) => c.key))
  if (recent.length > 3) recent.shift()
  const side = (c) => ({ type: c.type, key: c.key, label: c.label })
  out.push({ date, cols: grid.cols.map(side), rows: grid.rows.map(side), solutions: grid.cells })
}
writeFileSync(`${R}/src/data/bingo_daily.json`, JSON.stringify(out, null, 1) + '\n')
const minCell = Math.min(...out.flatMap((g) => g.solutions.flat()))
console.log(`${out.length} grids from ${FROM} written | fewest solutions in any cell: ${minCell} | example ${out[0]?.date}: columns ${out[0]?.cols.map((c) => c.label).join(' / ')} | rows ${out[0]?.rows.map((c) => c.label).join(' / ')}`)
