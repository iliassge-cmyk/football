import players from '../data/players.json'
import { CLUB_LEAGUE } from './leagues'

// Blind Ranking: footballers appear one by one and each one has to be placed on a free rank straight away. There is no right answer - the group
// settles the "true" ranking afterwards and every blind ranking is compared with that.

const isRetired = (p) => /\(retired\)\s*$/i.test(p.club || '')

/** players.json `position` is free text ("Right Winger", "DF", ...): one of four groups. */
export function positionGroup(p) {
  const s = (p.position || '').toLowerCase()
  if (/keeper|\bgk\b/.test(s)) return 'Goalkeeper'
  if (/back|defend|\bdf\b/.test(s)) return 'Defender'
  if (/midfield|\bmf\b/.test(s)) return 'Midfielder'
  return 'Forward'
}

export const POSITION_OPTIONS = [
  { id: 'any', label: 'Any' },
  { id: 'Forward', label: 'Forwards' },
  { id: 'Midfielder', label: 'Midfielders' },
  { id: 'Defender', label: 'Defenders' },
  { id: 'Goalkeeper', label: 'Goalkeepers' },
]
// Everybody in a round is worth at least this much (retired legends have no market value and are covered by the legends switch).
export const MIN_VALUE = 15_000_000
export const LEAGUE_CHOICES = [
  { id: 'any', label: 'Any' },
  { id: 'premier-league', label: 'Premier League' },
  { id: 'la-liga', label: 'La Liga' },
  { id: 'bundesliga', label: 'Bundesliga' },
  { id: 'serie-a', label: 'Serie A' },
  { id: 'ligue-1', label: 'Ligue 1' },
]
export const DEFAULT_FILTERS = { league: 'any', country: 'any', position: 'any', legends: true }

/** Footballers that match the filters: everybody with at least €15m plus (if switched on) the retired legends. */
export function buildPool(f) {
  return players.filter((p) => {
    if (isRetired(p)) {
      if (!f.legends) return false
    } else if (!(Number.isFinite(p.market_value_eur) && p.market_value_eur >= MIN_VALUE)) return false
    if (f.league !== 'any' && CLUB_LEAGUE[p.club] !== f.league) return false
    if (f.country !== 'any' && p.nationality !== f.country) return false
    if (f.position !== 'any' && positionGroup(p) !== f.position) return false
    return true
  })
}

/** The six big football nations. */
export const COUNTRY_CHOICES = ['Germany', 'France', 'Italy', 'Spain', 'England', 'Brazil']

export function filterSummary(f) {
  const parts = []
  if (f.league !== 'any') parts.push(LEAGUE_CHOICES.find((o) => o.id === f.league)?.label)
  if (f.country !== 'any') parts.push(f.country)
  if (f.position !== 'any') parts.push(POSITION_OPTIONS.find((o) => o.id === f.position)?.label)
  if (!f.legends) parts.push('Active players')
  return parts.length ? parts.join(' · ') : 'All footballers'
}

/** `n` different footballers in random order (the same list for every player of a round). */
export function drawSequence(pool, n) {
  const a = pool.slice()
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (a.length - i))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

export const SUGGESTIONS = ['Best first touch', 'Most overrated', 'Who wins a fight', 'Best hair', 'Best celebration', 'Dream dinner guest', 'Best at penalties', 'Pure class', 'Best captain', 'Most clutch']

/** Order of the footballers by their average place on all boards (the starting point when the group settles the ranking). */
export function averageOrder(boards, sequence) {
  const avg = (id) => boards.reduce((s, b) => s + b.indexOf(id), 0) / boards.length
  return sequence.map((p) => p.id).sort((a, b) => avg(a) - avg(b) || a.localeCompare(b))
}

/** How close a blind board is to the settled ranking: 100 = identical, 0 = reversed (sum of place differences against the worst case). */
export function accuracy(board, finalIds) {
  const n = finalIds.length
  const dist = finalIds.reduce((s, id, i) => s + Math.abs(board.indexOf(id) - i), 0)
  const worst = Math.floor((n * n) / 2)
  return { percent: Math.round(100 * (1 - dist / worst)), exact: finalIds.filter((id, i) => board[i] === id).length }
}

/** The footballer one board put furthest from the settled place. */
export function biggestMiss(board, finalIds) {
  let best = null
  finalIds.forEach((id, i) => {
    const d = Math.abs(board.indexOf(id) - i)
    if (!best || d > best.diff) best = { id, diff: d, placed: board.indexOf(id), final: i }
  })
  return best
}
