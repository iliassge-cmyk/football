// The bot opponent for Bidding War: it values a player by his market value compared with the others in the pool,
// bids in small steps while the price is below that value, and passes above it. A little randomness keeps it from being predictable.
import { BUDGET, ROSTER_SIZE, actorOf, bidLimits, currentPlayer } from './biddingEngine'

function worth(state, rnd) {
  const avg = state.pool.reduce((a, p) => a + p.market_value_eur, 0) / state.pool.length
  const fair = (currentPlayer(state).market_value_eur / avg) * (BUDGET / ROSTER_SIZE) // an average player is worth about €4
  return fair * (0.8 + rnd() * 0.55)
}

/** The action the bot takes for the seat that is acting now (only call it for a team index, not for the sale confirmation). */
export function botDecide(state, rnd = Math.random) {
  const lim = bidLimits(state)
  const w = worth(state, rnd)
  const cap = Math.min(Math.round(w), lim.max)
  if (state.phase === 'opening') {
    const amount = Math.max(1, Math.min(lim.max, rnd() < 0.25 ? Math.round(w * 0.5) : Math.round(w * 0.25) || 1))
    return { type: 'open', amount }
  }
  if (lim.min > cap) return { type: 'pass' }
  const jump = w - lim.min >= 4 && rnd() < 0.35 ? 2 : 1
  return { type: 'raise', amount: Math.min(lim.min + jump - 1, cap) }
}

/** Thinking time in ms, so the bot does not answer instantly. */
export const botDelay = (rnd = Math.random) => 900 + Math.round(rnd() * 1100)

export const isBotTurn = (state, botIndex) => actorOf(state) === botIndex
