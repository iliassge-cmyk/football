import players from '../data/players.json'
import clubs from '../data/clubs.json'
import coachList from '../data/coaches.json'

// Football Bingo: 3 categories on top, 3 on the left; every field needs a footballer who fits both of its categories. A category is a club he played for,
// his nationality, a title he won or a coach he played under (all from players.json: clubs, nationality, titles, coaches). Every grid is made on the spot
// and only accepted when each of its 9 fields has at least MIN_SOLUTIONS footballers - so every grid can be completed.

export const BINGO_PLAYERS = players.filter((p) => Array.isArray(p.clubs) && p.clubs.length)
const BY_ID = new Map(BINGO_PLAYERS.map((p) => [p.id, p]))
export const bingoPlayer = (id) => BY_ID.get(id) ?? null

const MIN_CLUB = 15, MIN_NAT = 20, MIN_TITLE = 25, MIN_COACH = 10 // a category is only used when this many footballers fit it
export const MIN_SOLUTIONS = 3

const TITLE_LABEL = {
  'UEFA Champions League winner': 'Champions League winner', 'Europa League winner': 'Europa League winner', 'Conference League winner': 'Conference League winner',
  'Uefa Supercup winner': 'UEFA Super Cup winner', 'FIFA Club World Cup winner': 'Club World Cup winner', 'Intercontinental Cup winner': 'Intercontinental Cup winner',
  'Copa Libertadores winner': 'Copa Libertadores winner', 'English Champion': 'Premier League champion', 'Spanish champion': 'La Liga champion', 'Italian champion': 'Serie A champion',
  'German Champion': 'Bundesliga champion', 'French champion': 'Ligue 1 champion', 'Dutch champion': 'Eredivisie champion', 'Portuguese champion': 'Primeira Liga champion',
  'Brazilian champion': 'Brazilian champion', 'Belgian champion': 'Belgian champion', 'Turkish champion': 'Turkish champion', 'Argentinian champion': 'Argentinian champion',
  'English FA Cup winner': 'FA Cup winner', 'English League Cup winner': 'League Cup winner', 'Spanish cup winner': 'Copa del Rey winner', 'German cup winner': 'DFB-Pokal winner',
  'Italian cup winner': 'Coppa Italia winner', 'French cup winner': 'Coupe de France winner', 'Dutch Cup winner': 'KNVB Cup winner', 'Portuguese cup winner': 'Taça de Portugal winner',
  'English Super Cup winner': 'Community Shield winner', 'Spanish Super Cup winner': 'Supercopa de España winner', 'Italian Super Cup winner': 'Supercoppa Italiana winner',
  'German Super Cup winner': 'German Super Cup winner', 'French Super Cup winner': 'Trophée des Champions winner', 'World Cup winner': 'World Cup winner', 'European champion': 'European champion',
  'Copa América winner': 'Copa América winner', 'Winner UEFA Nations League': 'Nations League winner', 'Confederations Cup winner': 'Confederations Cup winner', 'Africa Cup winner': 'Africa Cup winner',
  "Winner Ballon d'Or": "Ballon d'Or winner",
}
// the same title under two Transfermarkt names is one category
const TITLE_ALIAS = { 'Uefa Cup winner': 'Europa League winner', 'FIFA Intercontinental Cup Winner': 'Intercontinental Cup winner' }

function hasTitle(p, key) {
  const t = p.titles ?? {}
  if ((t[key] ?? 0) > 0) return true
  return Object.keys(TITLE_ALIAS).some((k) => TITLE_ALIAS[k] === key && (t[k] ?? 0) > 0)
}

/** Does the footballer fit the category ({ type: 'club' | 'nat' | 'title' | 'coach', key })? */
export function fits(p, cat) {
  if (cat.type === 'club') return p.clubs?.includes(cat.key) ?? false
  if (cat.type === 'nat') return p.nationality === cat.key
  if (cat.type === 'coach') return p.coaches?.includes(cat.key) ?? false
  return hasTitle(p, cat.key)
}

function buildCategories() {
  const out = []
  const add = (type, key, label, test) => {
    const n = BINGO_PLAYERS.filter(test).length
    const min = { club: MIN_CLUB, nat: MIN_NAT, title: MIN_TITLE, coach: MIN_COACH }[type]
    if (n >= min) out.push({ type, key, label, n })
  }
  for (const c of clubs) if (!c.reserve && c.type !== 'national_team') add('club', c.id, c.name, (p) => p.clubs.includes(c.id))
  const nats = new Set(BINGO_PLAYERS.map((p) => p.nationality).filter(Boolean))
  for (const nat of nats) add('nat', nat, nat, (p) => p.nationality === nat)
  for (const key of Object.keys(TITLE_LABEL)) add('title', key, TITLE_LABEL[key], (p) => hasTitle(p, key))
  for (const c of coachList) add('coach', c.id, c.name, (p) => p.coaches?.includes(c.id))
  return out
}
export const CATEGORIES = buildCategories()
const CAT_BY_KEY = new Map(CATEGORIES.map((c) => [`${c.type}:${c.key}`, c]))
/** A category from what was sent by another device (null when this version of the site does not know it). */
export const categoryOf = (type, key) => CAT_BY_KEY.get(`${type}:${key}`) ?? null
export const TYPE_NAME = { club: 'club', nat: 'nation', title: 'title', coach: 'coach' }

const overlapCache = new Map()
/** How many footballers fit both categories (remembered: the random grids ask for the same pairs again and again). */
export function overlap(a, b) {
  const key = `${a.type}:${a.key}|${b.type}:${b.key}`
  if (!overlapCache.has(key)) overlapCache.set(key, BINGO_PLAYERS.filter((p) => fits(p, a) && fits(p, b)).length)
  return overlapCache.get(key)
}
export const solutionsOf = (row, col) => BINGO_PLAYERS.filter((p) => fits(p, row) && fits(p, col))
export const fitsCell = (p, row, col) => fits(p, row) && fits(p, col)

// bigger categories come up more often (their fields more likely have solutions); coaches a bit less often so they stay a spice
const WEIGHT = { club: 1, nat: 1, title: 1, coach: 0.7 }
function pick(r) {
  const w = CATEGORIES.map((c) => Math.sqrt(c.n) * WEIGHT[c.type])
  let x = r() * w.reduce((a, b) => a + b, 0)
  for (let i = 0; i < CATEGORIES.length; i++) { x -= w[i]; if (x <= 0) return CATEGORIES[i] }
  return CATEGORIES[CATEGORIES.length - 1]
}

/**
 * A new random grid: { cols: [3 categories], rows: [3 categories], solutions: [[n x3] x3] }. Every field has at least `min` footballers. A nation may only be on one
 * side (two nations on the same side are fine: no footballer fits two nations), at most one coach is in a grid, and the kinds are mixed at random.
 */
export function randomGrid(rnd = Math.random, min = MIN_SOLUTIONS) {
  for (let attempt = 0; attempt < 6000; attempt++) {
    const cols = [pick(rnd), pick(rnd), pick(rnd)]
    const rows = [pick(rnd), pick(rnd), pick(rnd)]
    const all = [...cols, ...rows]
    if (new Set(all.map((c) => `${c.type}:${c.key}`)).size < 6) continue
    if (cols.some((c) => c.type === 'nat') && rows.some((c) => c.type === 'nat')) continue
    if (all.filter((c) => c.type === 'nat').length > 2 || all.filter((c) => c.type === 'coach').length > 1 || all.filter((c) => c.type === 'title').length > 3) continue
    const solutions = rows.map((row) => cols.map((col) => overlap(row, col)))
    if (solutions.flat().some((n) => n < min)) continue
    return { cols, rows, solutions }
  }
  return min > 1 ? randomGrid(rnd, min - 1) : null
}
