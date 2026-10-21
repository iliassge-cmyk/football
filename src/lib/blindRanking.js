import players from '../data/players.json'
import { CLUB_LEAGUE } from './leagues'

// Blind Ranking: footballers appear one by one and each one has to be placed on a free rank straight away. There is no right answer - the group
// there is no score and no winner: at the end the rankings of everybody are shown side by side and the friends argue about them.

const isRetired = (p) => /\(retired\)\s*$/i.test(p.club || '')

/** players.json `position` is free text ("Right Winger", "DF", ...): one of four groups. */
export function positionGroup(p) {
  const s = (p.position || '').toLowerCase()
  if (/keeper|\bgk\b/.test(s)) return 'Goalkeeper'
  if (/back|defend|\bdf\b/.test(s)) return 'Defender'
  if (/midfield|\bmf\b/.test(s)) return 'Midfielder'
  return 'Forward'
}

export const PLAYER_COLORS = ['#fb7a24', '#4fc3ff', '#a3e635', '#f472b6']
export const POSITION_OPTIONS = [
  { id: 'any', label: 'Any' },
  { id: 'Forward', label: 'Forwards' },
  { id: 'Midfielder', label: 'Midfielders' },
  { id: 'Defender', label: 'Defenders' },
  { id: 'Goalkeeper', label: 'Goalkeepers' },
]
// Everybody active in a round is worth at least €30m, or €60m with the stricter choice. Retired legends have no market value: they are a separate switch that works with both choices.
export const VALUE_OPTIONS = [
  { id: '30', label: '€30m+', min: 30_000_000 },
  { id: '60', label: '€60m+', min: 60_000_000 },
]
export const LEAGUE_CHOICES = [
  { id: 'any', label: 'Any' },
  { id: 'premier-league', label: 'Premier League' },
  { id: 'la-liga', label: 'La Liga' },
  { id: 'bundesliga', label: 'Bundesliga' },
  { id: 'serie-a', label: 'Serie A' },
  { id: 'ligue-1', label: 'Ligue 1' },
]
export const DEFAULT_FILTERS = { league: 'any', country: 'any', position: 'any', value: '30', legends: true }

/** Footballers that match the filters: everybody with the minimum market value plus, if switched on, the retired legends. */
export function buildPool(f) {
  const minValue = (VALUE_OPTIONS.find((o) => o.id === f.value) ?? VALUE_OPTIONS[0]).min
  return players.filter((p) => {
    if (isRetired(p)) {
      if (!f.legends) return false
    } else if (!(Number.isFinite(p.market_value_eur) && p.market_value_eur >= minValue)) return false
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
  if (f.value !== '30') parts.push(VALUE_OPTIONS.find((o) => o.id === f.value)?.label + (f.legends ? ' + legends' : ''))
  else if (!f.legends) parts.push('Active players')
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

const BY_ID = new Map(players.map((p) => [p.id, p]))
/** The footballers of a round from their ids (what is sent between the devices of an online round); null when one is unknown to this version of the site. */
export function sequenceFromIds(ids) {
  const list = ids.map((id) => BY_ID.get(id))
  return list.every(Boolean) ? list : null
}
/** A board received from another device: exactly the footballers of the round, every one once. */
export function validBoard(board, ids) {
  return Array.isArray(board) && board.length === ids.length && new Set(board).size === ids.length && board.every((id) => ids.includes(id))
}
