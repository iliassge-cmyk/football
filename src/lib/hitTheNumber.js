import players from '../data/players.json'

// Hit the Number: a target number is drawn for a stat (career goals, assists, market value ...). Everybody drafts 5 footballers, the stat values of the
// five are added up in the end and whoever is closest to the target wins (going over is fine - only the distance counts).

export const TEAM_SIZE = 5
export const MAX_PLAYERS = 4
const MIN_POOL = 100 // a category is only offered when at least this many footballers have the stat (goalkeeper clean sheets are too few for now)

const isKeeper = (p) => /keeper|\bgk\b/i.test(p.position || '')
const isRetired = (p) => p.status === 'retired'

export const CATEGORIES = [
  { id: 'goals', label: 'career goals', unit: 'goals', step: 5, value: (p) => p.career_goals, eligible: (p) => !isKeeper(p) && Number.isFinite(p.career_goals) },
  { id: 'assists', label: 'career assists', unit: 'assists', step: 5, value: (p) => p.career_assists, eligible: (p) => !isKeeper(p) && Number.isFinite(p.career_assists) },
  { id: 'value', label: 'market value', unit: '€m', step: 5, value: (p) => Math.round(p.market_value_eur / 1e6), eligible: (p) => !isRetired(p) && p.market_value_eur > 0 },
  { id: 'cleansheets', label: 'career clean sheets', unit: 'clean sheets', step: 5, value: (p) => p.career_clean_sheets, eligible: (p) => isKeeper(p) && Number.isFinite(p.career_clean_sheets) },
]

const quantile = (sorted, f) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))]

/** The categories that have enough footballers, each with its pool and the range its targets are drawn from (5x the 20th to 5x the 80th percentile: always reachable many ways). */
export const ACTIVE_CATEGORIES = CATEGORIES.map((c) => {
  const pool = players.filter(c.eligible).map((p) => ({ ...p, stat: c.value(p) }))
  const sorted = pool.map((p) => p.stat).sort((a, b) => a - b)
  return { ...c, pool, lo: Math.max(c.step * 5, TEAM_SIZE * quantile(sorted, 0.2)), hi: TEAM_SIZE * quantile(sorted, 0.8) }
}).filter((c) => c.pool.length >= MIN_POOL)

/** A new round: a random category (not the one before, if there is a choice) and a random target. */
export function drawRound(previousId = null, rnd = Math.random) {
  const options = ACTIVE_CATEGORIES.filter((c) => c.id !== previousId)
  const cat = (options.length ? options : ACTIVE_CATEGORIES)[Math.floor(rnd() * (options.length || ACTIVE_CATEGORIES.length))]
  const steps = Math.floor((cat.hi - cat.lo) / cat.step)
  const target = cat.lo + Math.floor(rnd() * (steps + 1)) * cat.step
  return { categoryId: cat.id, target }
}

/** Snake draft order: 0,1,2,3 then 3,2,1,0 then 0,1,2,3 ... (everybody picks TEAM_SIZE times). */
export function draftOrder(count) {
  const order = []
  for (let r = 0; r < TEAM_SIZE; r++) {
    const ids = Array.from({ length: count }, (_, i) => i)
    order.push(...(r % 2 ? ids.reverse() : ids))
  }
  return order
}

/** Final standings from the picks ([[player...], ...]): sum, distance to the target, rank (equal distance = equal rank). */
export function standings(teams, target) {
  const rows = teams.map((picks, i) => {
    const sum = picks.reduce((a, p) => a + p.stat, 0)
    return { index: i, sum, diff: Math.abs(sum - target) }
  })
  const sorted = [...rows].sort((a, b) => a.diff - b.diff)
  return rows.map((r) => ({ ...r, rank: sorted.findIndex((x) => x.diff === r.diff) + 1 }))
}
