import { useEffect, useState } from 'react'
import { CaretLeft, CaretRight, Gavel } from '@phosphor-icons/react'
import PlayerIdentity from './PlayerIdentity'
import { BiddingResults, TeamsBar, TeamsPanel } from './biddingParts'
import { actorOf, bidLimits, currentPlayer } from '../lib/biddingEngine'

/**
 * One screen for games where every player has his own device (bot or online): shows the auction from the seat `me`.
 * Bidding takes one tap: the big button is the lowest legal bid, the small buttons jump higher.
 *   onAction(action)   a bid / pass of this player
 *   waitingText        what to say while somebody else is acting (e.g. "Bot is thinking")
 *   timeLeft           seconds left for this decision (online games), or null
 */
export default function BiddingMatch({ state, me, onAction, waitingText, timeLeft = null, onAgain, againLabel, onLeave, banner = null, resultsExtra = null, children = null }) {
  // the amount the player is about to bid; it starts at the lowest legal bid again for every new decision
  const [pick, setPick] = useState({ key: null, v: 0 })
  // the "Sold" note stays for 1.5 s
  const [hiddenSale, setHiddenSale] = useState(null)
  const toast = state.lastSale && state.lastSale !== hiddenSale ? state.lastSale : null
  useEffect(() => {
    if (!state.lastSale) return undefined
    const t = setTimeout(() => setHiddenSale(state.lastSale), 1500)
    return () => clearTimeout(t)
  }, [state.lastSale])

  if (state.phase === 'done') {
    return (
      <>
        {toast && <SoldToast sale={toast} teams={state.teams} me={me} />}
        <BiddingResults teams={state.teams} onAgain={onAgain} againLabel={againLabel}>
          {resultsExtra}
        </BiddingResults>
      </>
    )
  }

  const actor = actorOf(state)
  const myTurn = actor === me
  const lim = typeof actor === 'number' ? bidLimits(state) : null
  const player = currentPlayer(state)
  const opening = state.phase === 'opening'
  const activeIndex = opening ? state.openerIndex : state.turnIndex ?? state.leaderIndex

  const decisionKey = `${state.poolIndex}:${state.currentBid}:${actor}`
  const amount = lim ? Math.min(lim.max, Math.max(lim.min, pick.key === decisionKey ? pick.v : lim.min)) : 0
  const step = (d) => setPick({ key: decisionKey, v: amount + d })

  return (
    <div className="mx-auto max-w-4xl">
      <TeamsBar teams={state.teams} activeIndex={activeIndex} leaderIndex={state.leaderIndex} />
      {toast && <SoldToast sale={toast} teams={state.teams} me={me} />}
      {banner}
      <div className="lg:grid lg:grid-cols-[minmax(0,24rem)_1fr] lg:items-start lg:gap-10">
        <div className="mx-auto w-full max-w-sm text-center">
          <p className="text-xs uppercase tracking-wide text-orange-glow font-semibold mb-2">
            Player {state.poolIndex + 1} of {state.pool.length}
          </p>
          <PlayerIdentity name={player.name} club={player.club} crestUrl={player.club_crest_url} />

          {!opening && (
            <div className="glass-card rounded-2xl p-4 my-5">
              <p className="text-xs text-white/50">Current bid</p>
              <p className="font-display text-4xl font-bold text-orange-glow">€{state.currentBid}</p>
              <p className="text-sm text-white/70 mt-1">
                Leading: <span className="text-white font-semibold">{state.teams[state.leaderIndex]?.name}</span>
              </p>
            </div>
          )}

          {myTurn && lim ? (
            <div className={opening ? 'mt-8' : ''}>
              <p className="text-sm text-white mb-3">
                {opening ? 'You open the bidding' : 'Your turn'}
                {timeLeft !== null && <span className={`ml-2 font-semibold ${timeLeft <= 5 ? 'text-red-400' : 'text-white/50'}`}>{timeLeft}s</span>}
              </p>
              <div className="mb-3 flex items-center justify-center gap-4">
                <button onClick={() => step(-1)} disabled={amount <= lim.min} aria-label="Lower bid" className="rounded-xl bg-white/10 p-3 text-white hover:bg-white/20 transition disabled:opacity-30">
                  <CaretLeft weight="bold" size={20} />
                </button>
                <span className="font-display text-4xl font-bold text-white w-20 text-center">€{amount}</span>
                <button onClick={() => step(1)} disabled={amount >= lim.max} aria-label="Raise bid" className="rounded-xl bg-white/10 p-3 text-white hover:bg-white/20 transition disabled:opacity-30">
                  <CaretRight weight="bold" size={20} />
                </button>
              </div>
              <button
                onClick={() => onAction({ type: opening ? 'open' : 'raise', amount })}
                className="w-full rounded-2xl bg-orange-glow px-4 py-4 text-base font-bold text-ink-950 hover:brightness-110 active:scale-[0.99] transition inline-flex items-center justify-center gap-2"
              >
                <Gavel weight="fill" /> {opening ? `Open at €${amount}` : `Bid €${amount}`}
              </button>
              {!opening && (
                <button
                  onClick={() => onAction({ type: 'pass' })}
                  className="mt-3 w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition"
                >
                  Pass
                </button>
              )}
              <p className="mt-3 text-[11px] text-white/35">You have €{state.teams[me].budget} left - keep €1 for every open slot.</p>
            </div>
          ) : (
            <p className="mt-8 flex items-center justify-center gap-2 text-sm text-white/60">
              <span className="inline-flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-glow" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-glow [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-glow [animation-delay:300ms]" />
              </span>
              {actor === 'sell' ? 'Sold!' : waitingText ?? `${state.teams[typeof actor === 'number' ? actor : 0].name} is bidding`}
            </p>
          )}
          {onLeave && (
            <div><button onClick={onLeave} className="mt-8 text-xs text-white/30 hover:text-white/60 transition">
              Leave game
            </button></div>
          )}
        </div>
        <TeamsPanel teams={state.teams} activeIndex={activeIndex} />
      </div>
      {children}
    </div>
  )
}

function SoldToast({ sale, teams, me }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[34%] z-40 flex justify-center px-4">
      <div className="rounded-2xl border border-orange-glow/50 bg-ink-950/95 px-5 py-3 text-center shadow-xl backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-glow">Sold</p>
        <p className="font-display text-lg font-bold text-white">{sale.player.name}</p>
        <p className="text-sm text-white/70">
          {sale.team === me ? 'You' : teams[sale.team].name} · €{sale.price}
        </p>
      </div>
    </div>
  )
}
