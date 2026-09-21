// Generates Daily Top 10 + Minefield challenge candidates computed directly
// from src/data/players.json — no external research needed, so results are
// only ever as reliable as the FotMob-refreshed dataset itself (see
// scripts/refresh-players-data.mjs). This is a *different flavour* from the
// existing hand-researched entries (which cover genuine all-time historical
// facts like Ballon d'Or wins or UCL titles - not tracked in players.json at
// all) - these are always "as of the current dataset" snapshots instead.
//
// Output is NOT written directly into daily_top10.json / minefield_categories.json:
// it's written to a review file (JSON + CSV) so a human can look over the
// batch first, per the project's existing "sourced and verified before it
// ships" standard - then copy the approved ones in.
//
// Usage: node scripts/generate-computed-challenges.mjs [--days=100]
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const daysArg = process.argv.find((a) => a.startsWith('--days='))
const DAY_COUNT = daysArg ? parseInt(daysArg.split('=')[1], 10) : 100

const players = JSON.parse(readFileSync(path.join(__dirname, '../src/data/players.json'), 'utf8'))
const isRetired = (p) => /\(retired\)\s*$/i.test(p.club || '')
const active = players.filter((p) => !isRetired(p))

function coarsePosition(label) {
  const s = (label || '').toLowerCase()
  if (/keeper|goalkeeper|\bgk\b/.test(s)) return 'Goalkeeper'
  if (/defen|\bdf\b/.test(s)) return 'Defender'
  if (/midfield|\bmf\b/.test(s)) return 'Midfielder'
  if (/forward|striker|wing|attack|\bfw\b/.test(s)) return 'Forward'
  return null
}

const ATTRS = {
  market_value_eur: {
    label: 'highest market values',
    unit: null,
    criteriaLabel: 'Market value',
    format: (n) => `€${(n / 1_000_000).toFixed(1)}M`,
  },
  career_goals: { label: 'most career goals', unit: 'goals', criteriaLabel: 'Career goals', format: (n) => `${n} goals` },
  career_assists: {
    label: 'most career assists',
    unit: 'assists',
    criteriaLabel: 'Career assists',
    format: (n) => `${n} assists`,
  },
}

const NATIONALITY_MIN_POOL = 18

function poolsToScan() {
  const pools = [{ scope: 'Global', filter: () => true }]

  for (const pos of ['Forward', 'Midfielder', 'Defender', 'Goalkeeper']) {
    pools.push({ scope: pos + 's', filter: (p) => coarsePosition(p.position) === pos })
  }

  const byNat = {}
  for (const p of active) byNat[p.nationality] = (byNat[p.nationality] || 0) + 1
  for (const [nat, count] of Object.entries(byNat)) {
    if (count >= NATIONALITY_MIN_POOL) pools.push({ scope: nat, filter: (p) => p.nationality === nat })
  }
  return pools
}

function buildTop10(pool, attrKey) {
  const meta = ATTRS[attrKey]
  const candidates = pool.filter((p) => Number.isFinite(p[attrKey]) && p[attrKey] > 0)
  if (candidates.length < 10) return null
  const sorted = [...candidates].sort((a, b) => b[attrKey] - a[attrKey])
  return {
    title: null, // filled in by caller with scope
    entries: sorted.slice(0, 10).map((p, i) => ({ rank: i + 1, name: p.name, value: meta.format(p[attrKey]) })),
  }
}

function buildMinefield(pool, attrKey) {
  const meta = ATTRS[attrKey]
  const candidates = pool.filter((p) => Number.isFinite(p[attrKey]) && p[attrKey] > 0)
  if (candidates.length < 16) return null
  const sorted = [...candidates].sort((a, b) => b[attrKey] - a[attrKey])
  const top10 = sorted.slice(0, 10)
  const next6 = sorted.slice(10, 16)
  if (next6.length < 6) return null
  const threshold = top10[9][attrKey]
  const tiles = [...top10, ...next6].map((p) => ({
    name: p.name,
    meets_criteria: p[attrKey] >= threshold,
    actual_value: meta.format(p[attrKey]),
  }))
  // shuffle so the 10 "safe" tiles aren't visually grouped first
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return {
    criteria_description: `${meta.criteriaLabel} ≥ ${meta.unit ? threshold : meta.format(threshold)} (computed snapshot, as of dataset refresh)`,
    threshold,
    tiles,
  }
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const existingTop10 = JSON.parse(readFileSync(path.join(__dirname, '../src/data/daily_top10.json'), 'utf8'))
const nextDate = addDays(existingTop10[existingTop10.length - 1].date, 1)
const today = new Date().toISOString().slice(0, 10)

const pools = poolsToScan()
const attrKeys = Object.keys(ATTRS)

// Every (pool, attribute) combination that has enough players, shuffled once
// so the day-to-day order isn't predictably "Global, Forwards, Midfielders...".
const combos = []
for (const pool of pools) {
  const poolPlayers = active.filter(pool.filter)
  for (const attrKey of attrKeys) {
    if (pool.scope === 'Goalkeepers' && attrKey !== 'market_value_eur') continue // GK goals/assists too rare to be interesting
    combos.push({ pool, poolPlayers, attrKey })
  }
}
for (let i = combos.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1))
  ;[combos[i], combos[j]] = [combos[j], combos[i]]
}

const top10Candidates = []
const minefieldCandidates = []
let comboIdx = 0

for (let day = 0; day < DAY_COUNT; day++) {
  const combo = combos[comboIdx % combos.length]
  comboIdx++
  const attrMeta = ATTRS[combo.attrKey]
  const result = buildTop10(combo.poolPlayers, combo.attrKey)
  if (!result) {
    day-- // pool too small for this combo - retry with the next one, don't burn a day slot
    continue
  }
  const possessive = combo.pool.scope.endsWith('s') ? `${combo.pool.scope}'` : `${combo.pool.scope}'s`
  top10Candidates.push({
    date: addDays(nextDate, top10Candidates.length),
    title: `${possessive} ${attrMeta.label} (current squads)`,
    entries: result.entries,
    source_primary: 'Computed from this project\'s players.json dataset (FotMob-sourced, refreshed weekly)',
    source_secondary: null,
    verified_date: today,
  })
}

comboIdx = 0
for (let i = 0; i < Math.min(DAY_COUNT, 60); i++) {
  const combo = combos[comboIdx % combos.length]
  comboIdx++
  const mf = buildMinefield(combo.poolPlayers, combo.attrKey)
  if (!mf) {
    i--
    continue
  }
  const slug = `${combo.pool.scope}-${combo.attrKey}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  minefieldCandidates.push({
    id: `computed-${slug}`,
    title: `${combo.pool.scope} with ${mf.criteria_description.replace(' (computed snapshot)', '')}`,
    criteria_description: mf.criteria_description,
    tiles: mf.tiles,
    source: 'Computed from this project\'s players.json dataset (FotMob-sourced, refreshed weekly)',
    verified_date: today,
  })
}

writeFileSync(
  path.join(__dirname, '../src/data/computed_top10_review.json'),
  JSON.stringify(top10Candidates, null, 2) + '\n'
)
writeFileSync(
  path.join(__dirname, '../src/data/computed_minefield_review.json'),
  JSON.stringify(minefieldCandidates, null, 2) + '\n'
)

// CSV for a quick human skim before anything is copied into the real data files.
const csvEscape = (v) => `"${String(v).replace(/"/g, '""')}"`
const csvLines = ['type,date_or_id,title,summary']
for (const c of top10Candidates) {
  csvLines.push(
    ['top10', c.date, c.title, c.entries.map((e) => `${e.rank}.${e.name}(${e.value})`).join(' | ')]
      .map(csvEscape)
      .join(',')
  )
}
for (const c of minefieldCandidates) {
  csvLines.push(
    [
      'minefield',
      c.id,
      c.title,
      c.tiles.map((t) => `${t.name}${t.meets_criteria ? '✓' : '✗'}(${t.actual_value})`).join(' | '),
    ]
      .map(csvEscape)
      .join(',')
  )
}
writeFileSync(path.join(__dirname, '../src/data/computed_challenges_review.csv'), csvLines.join('\n') + '\n')

console.log(`Generated ${top10Candidates.length} Daily Top 10 candidates (${nextDate} onward) -> src/data/computed_top10_review.json`)
console.log(`Generated ${minefieldCandidates.length} Minefield candidates -> src/data/computed_minefield_review.json`)
console.log(`Combined CSV for review -> src/data/computed_challenges_review.csv`)
console.log(`\nNothing was written to daily_top10.json / minefield_categories.json - review the above, then copy in what you approve.`)
