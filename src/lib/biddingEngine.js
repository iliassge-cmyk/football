// Rules of Bidding War as pure functions, so the same code runs for "against a bot" and for online games
// (both devices apply the same actions to the same state and always end up with the same result).
//
// state = { phase: 'opening' | 'auction' | 'done', teams, pool, poolIndex, openerIndex, currentBid, leaderIndex, passed, turnIndex, lastSale }
// actions: { type: 'open', amount } | { type: 'raise', amount } | { type: 'pass' } | { type: 'sell' }
import players from '../data/players.json'

export const BUDGET = 20
export const ROSTER_SIZE = 5
export const MIN_VALUE = 18_000_000

const isGoalkeeper = (p) => /keeper|goalkeeper|\bgk\b/i.test(p.position || '')
export const POOL = players.filter((p) => !isGoalkeeper(p) && Number.isFinite(p.market_value_eur) && p.market_value_eur >= MIN_VALUE)

/** Small seeded random generator: the same seed gives the same shuffle on every device. */
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function shuffledWith(arr, rnd) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Most this team may legally bid right now, reserving >=1 for every slot still needed after this one. */
export function maxLegalBid(team) {
  const slotsAfterThis = ROSTER_SIZE - team.roster.length - 1
  return team.budget - slotsAfterThis
}
export const isFull = (team) => team.roster.length >= ROSTER_SIZE

/** Next team (after fromIndex, wrapping) whose roster isn't full yet - who opens the next auction. */
export function nextOpener(fromIndex, teams) {
  const n = teams.length
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n
    if (!isFull(teams[idx])) return idx
  }
  return null
}

/** Next team to act in the current auction (seat order); null once nobody can act any more - the leader wins. */
export function nextTurn(fromIndex, teams, leaderIdx, passedList, bid) {
  const n = teams.length
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n
    if (idx === leaderIdx) continue
    if (passedList.includes(idx)) continue
    if (isFull(teams[idx])) continue
    if (maxLegalBid(teams[idx]) <= bid) continue
    return idx
  }
  return null
}

export function createGame({ names, seed, pool = POOL }) {
  const teams = names.map((name) => ({ name, budget: BUDGET, roster: [] }))
  return {
    phase: 'opening',
    teams,
    pool: shuffledWith(pool, mulberry32(seed)).slice(0, teams.length * ROSTER_SIZE),
    poolIndex: 0,
    openerIndex: 0,
    currentBid: 0,
    leaderIndex: null,
    passed: [],
    turnIndex: null,
    lastSale: null,
  }
}

/** Who has to act now: a team index, 'sell' (everyone passed - the sale is confirmed) or null (game over). */
export function actorOf(state) {
  if (state.phase === 'opening') return state.openerIndex
  if (state.phase === 'auction') return state.turnIndex === null ? 'sell' : state.turnIndex
  return null
}
export const currentPlayer = (state) => state.pool[state.poolIndex]

/** Applies one action; returns the new state, or null when the action is not allowed right now. */
export function applyAction(state, action) {
  if (state.phase === 'opening' && action.type === 'open') {
    const opener = state.teams[state.openerIndex]
    if (!Number.isInteger(action.amount) || action.amount < 1 || action.amount > maxLegalBid(opener)) return null
    return {
      ...state,
      phase: 'auction',
      currentBid: action.amount,
      leaderIndex: state.openerIndex,
      passed: [],
      turnIndex: nextTurn(state.openerIndex, state.teams, state.openerIndex, [], action.amount),
    }
  }
  if (state.phase === 'auction' && state.turnIndex !== null && action.type === 'raise') {
    const team = state.teams[state.turnIndex]
    if (!Number.isInteger(action.amount) || action.amount <= state.currentBid || action.amount > maxLegalBid(team)) return null
    const leader = state.turnIndex
    return { ...state, currentBid: action.amount, leaderIndex: leader, turnIndex: nextTurn(leader, state.teams, leader, state.passed, action.amount) }
  }
  if (state.phase === 'auction' && state.turnIndex !== null && action.type === 'pass') {
    const passed = [...state.passed, state.turnIndex]
    return { ...state, passed, turnIndex: nextTurn(state.turnIndex, state.teams, state.leaderIndex, passed, state.currentBid) }
  }
  if (state.phase === 'auction' && state.turnIndex === null && action.type === 'sell') {
    const player = currentPlayer(state)
    const teams = state.teams.map((t, i) =>
      i === state.leaderIndex ? { ...t, budget: t.budget - state.currentBid, roster: [...t.roster, { ...player, paid: state.currentBid }] } : t,
    )
    const lastSale = { player, team: state.leaderIndex, price: state.currentBid }
    const upcoming = nextOpener(state.openerIndex, teams)
    if (upcoming === null || state.poolIndex + 1 >= state.pool.length) return { ...state, teams, phase: 'done', lastSale, turnIndex: null }
    return { ...state, teams, lastSale, phase: 'opening', poolIndex: state.poolIndex + 1, openerIndex: upcoming, currentBid: 0, leaderIndex: null, passed: [], turnIndex: null }
  }
  return null
}

/** The amounts the acting team can bid (for quick-bid buttons): at least `min`, at most `max`. */
export function bidLimits(state) {
  const actor = actorOf(state)
  if (typeof actor !== 'number') return null
  const team = state.teams[actor]
  return { min: state.phase === 'opening' ? 1 : state.currentBid + 1, max: maxLegalBid(team) }
}
