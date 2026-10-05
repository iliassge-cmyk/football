import { useState } from 'react'
import { CaretLeft, CaretRight, Coins, Gavel } from '@phosphor-icons/react'
import GameIntroModal from './GameIntroModal'
import PlayerIdentity from './PlayerIdentity'
import players from '../data/players.json'

const MIN_PLAYERS = 2
const MAX_PLAYERS = 4
const BUDGET = 20
const ROSTER_SIZE = 5
const MIN_VALUE = 18_000_000

const isGoalkeeper = (p) => /keeper|goalkeeper|\bgk\b/i.test(p.position || '')
const POOL = players.filter(
  (p) => !isGoalkeeper(p) && Number.isFinite(p.market_value_eur) && p.market_value_eur >= MIN_VALUE,
)

function shuffled(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Most this team may legally bid right now, reserving >=1 for every slot still needed after this one. */
function maxLegalBid(team) {
  const slotsAfterThis = ROSTER_SIZE - team.roster.length - 1
  return team.budget - slotsAfterThis
}

function isFull(team) {
  return team.roster.length >= ROSTER_SIZE
}

/** Next team (after fromIndex, wrapping) whose roster isn't full yet - used to pick who opens the next auction. */
function nextOpener(fromIndex, teamsList) {
  const n = teamsList.length
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n
    if (!isFull(teamsList[idx])) return idx
  }
  return null
}

/**
 * Next team whose turn it is to act in the current auction, walking the table in seat
 * order starting right after fromIndex. Skips the current leader (no bidding against
 * yourself), anyone who already passed this auction, and anyone who can no longer
 * legally beat the current bid. Returns null once nobody is left to act - the auction
 * is over and the leader wins.
 */
function nextTurn(fromIndex, teamsList, leaderIdx, passedList, bid) {
  const n = teamsList.length
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n
    if (idx === leaderIdx) continue
    if (passedList.includes(idx)) continue
    if (isFull(teamsList[idx])) continue
    if (maxLegalBid(teamsList[idx]) <= bid) continue
    return idx
  }
  return null
}

/** Slim bar that stays visible while bidding: every team's budget and how many players it has. */
function TeamsBar({ teams, activeIndex, leaderIndex }) {
  return (
    <div className="sticky top-[61px] z-30 -mx-4 -mt-6 mb-5 border-b border-white/10 bg-ink-950/90 px-4 py-2 backdrop-blur-md">
      <div className="grid grid-flow-col auto-cols-fr gap-1.5 sm:gap-2">
        {teams.map((t, i) => (
          <div
            key={i}
            className={`min-w-0 rounded-lg border px-2 py-1.5 text-left sm:px-2.5 ${
              i === activeIndex ? 'border-orange-glow bg-orange-glow/10' : 'border-white/10 bg-white/[0.03]'
            }`}
          >
            <p className="truncate text-[11px] font-semibold text-white/80">
              {t.name}
              {i === leaderIndex && <span className="ml-1 text-orange-glow">· leading</span>}
            </p>
            <p className="flex items-baseline gap-2">
              <span className="font-display text-lg font-bold text-white">€{t.budget}</span>
              <span className="text-[10px] text-white/40">
                {t.roster.length}/{ROSTER_SIZE}
                <span className="hidden sm:inline"> players</span>
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Every team's current squad (with the price paid) and budget left; the team that acts right now is outlined. */
function TeamsPanel({ teams, activeIndex }) {
  return (
    <div className="mt-8 grid gap-3 text-left sm:grid-cols-2 lg:mt-0 lg:grid-cols-1">
      {teams.map((t, i) => (
        <div key={i} className={`glass-card rounded-2xl p-4 ${i === activeIndex ? 'ring-1 ring-orange-glow/60' : ''}`}>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="truncate font-display text-base font-bold text-white">{t.name}</h3>
            <span className="shrink-0 text-xs text-white/50">€{t.budget} left</span>
          </div>
          <ul className="space-y-1">
            {Array.from({ length: ROSTER_SIZE }, (_, s) => {
              const p = t.roster[s]
              return p ? (
                <li key={s} className="flex justify-between gap-2 text-sm text-white/80">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-white/40">€{p.paid}</span>
                </li>
              ) : (
                <li key={s} className="text-sm text-white/20">
                  Slot {s + 1} open
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default function BiddingWar() {
  const [phase, setPhase] = useState('setup') // setup | opening | auction | done
  const [count, setCount] = useState(3)
  const [names, setNames] = useState(['', '', ''])
  const [teams, setTeams] = useState([])
  const [pool, setPool] = useState([])
  const [poolIndex, setPoolIndex] = useState(0)
  const [openerIndex, setOpenerIndex] = useState(0)
  const [openBidInput, setOpenBidInput] = useState(1)
  const [currentBid, setCurrentBid] = useState(0)
  const [leaderIndex, setLeaderIndex] = useState(null)
  const [passed, setPassed] = useState([])
  const [turnIndex, setTurnIndex] = useState(null)
  const [bidInput, setBidInput] = useState(0)

  function setCountAndResize(n) {
    const clamped = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n))
    setCount(clamped)
    setNames((prev) => {
      const next = prev.slice(0, clamped)
      while (next.length < clamped) next.push('')
      return next
    })
  }

  function startDraft() {
    const finalTeams = names.map((n, i) => ({ name: n.trim() || `Team ${i + 1}`, budget: BUDGET, roster: [] }))
    setTeams(finalTeams)
    setPool(shuffled(POOL).slice(0, finalTeams.length * ROSTER_SIZE))
    setPoolIndex(0)
    setOpenerIndex(0)
    setOpenBidInput(1)
    setPhase('opening')
  }

  const currentPlayer = pool[poolIndex]
  const opener = teams[openerIndex]
  const turnTeam = turnIndex !== null ? teams[turnIndex] : null

  function openBidding() {
    const bid = openBidInput
    setCurrentBid(bid)
    setLeaderIndex(openerIndex)
    setPassed([])
    const next = nextTurn(openerIndex, teams, openerIndex, [], bid)
    setTurnIndex(next)
    if (next !== null) setBidInput(bid + 1)
    setPhase('auction')
  }

  function confirmBid() {
    const amount = bidInput
    const newLeader = turnIndex
    setCurrentBid(amount)
    setLeaderIndex(newLeader)
    const next = nextTurn(newLeader, teams, newLeader, passed, amount)
    setTurnIndex(next)
    if (next !== null) setBidInput(amount + 1)
  }

  function passTurn() {
    const newPassed = [...passed, turnIndex]
    setPassed(newPassed)
    const next = nextTurn(turnIndex, teams, leaderIndex, newPassed, currentBid)
    setTurnIndex(next)
    if (next !== null) setBidInput(currentBid + 1)
  }

  function sellToLeader() {
    const updated = teams.map((t, i) =>
      i === leaderIndex
        ? { ...t, budget: t.budget - currentBid, roster: [...t.roster, { ...currentPlayer, paid: currentBid }] }
        : t,
    )
    setTeams(updated)

    const nextPool = poolIndex + 1
    const upcomingOpener = nextOpener(openerIndex, updated)

    if (upcomingOpener === null || nextPool >= pool.length) {
      setPhase('done')
      return
    }

    setPoolIndex(nextPool)
    setOpenerIndex(upcomingOpener)
    setOpenBidInput(1)
    setLeaderIndex(null)
    setCurrentBid(0)
    setPassed([])
    setTurnIndex(null)
    setPhase('opening')
  }

  function playAgain() {
    setPhase('setup')
  }

  if (phase === 'setup') {
    return (
      <div className="mx-auto max-w-md">
        <GameIntroModal gameKey="bidding-war" title="Bidding War">
          <p>A pass-the-phone auction draft. Each team gets a €20 budget to bid for 5 players.</p>
          <p>Who opens each auction rotates like a poker dealer button, then bidding goes around the table in that same seat order - raise by any amount you like, or pass. Once everyone else has passed, the highest bid wins.</p>
          <p>No single winner at the end - just a side-by-side team comparison to argue about with your friends.</p>
        </GameIntroModal>

        <h2 className="font-display text-2xl font-bold text-white mb-1">Bidding War</h2>
        <p className="text-sm text-white/50 mb-6">Set up your teams, then pass the phone around to bid.</p>

        <label className="block text-sm text-white/70 mb-1">Number of teams</label>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setCountAndResize(count - 1)}
            disabled={count <= MIN_PLAYERS}
            className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20 transition disabled:opacity-30"
          >
            <CaretLeft weight="bold" />
          </button>
          <span className="font-display text-2xl font-bold text-white w-10 text-center">{count}</span>
          <button
            onClick={() => setCountAndResize(count + 1)}
            disabled={count >= MAX_PLAYERS}
            className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20 transition disabled:opacity-30"
          >
            <CaretRight weight="bold" />
          </button>
        </div>

        <label className="block text-sm text-white/70 mb-2">Team names</label>
        <div className="space-y-2 mb-6">
          {names.map((name, i) => (
            <input
              key={i}
              value={name}
              onChange={(e) => setNames((prev) => prev.map((n, idx) => (idx === i ? e.target.value : n)))}
              placeholder={`Team ${i + 1}`}
              className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-orange-glow"
            />
          ))}
        </div>

        <p className="text-xs text-white/40 mb-4">
          Each team: €{BUDGET} budget, {ROSTER_SIZE} players, field players only (€{MIN_VALUE / 1_000_000}M+ market value).
        </p>

        <button
          onClick={startDraft}
          className="w-full rounded-xl bg-orange-glow px-4 py-3 text-sm font-bold text-ink-950 hover:brightness-110 transition"
        >
          Start Draft
        </button>
      </div>
    )
  }

  if (phase === 'opening') {
    return (
      <div className="mx-auto max-w-4xl">
        <TeamsBar teams={teams} activeIndex={openerIndex} />
        <div className="lg:grid lg:grid-cols-[minmax(0,24rem)_1fr] lg:items-start lg:gap-10">
          <div className="mx-auto w-full max-w-sm text-center">
            <p className="text-xs uppercase tracking-wide text-orange-glow font-semibold mb-2">
              Player {poolIndex + 1} of {pool.length}
            </p>
            <PlayerIdentity name={currentPlayer.name} club={currentPlayer.club} crestUrl={currentPlayer.club_crest_url} />
            <p className="mt-6 text-lg text-white">
              <span className="text-orange-glow font-bold">{opener.name}</span> opens the bidding
            </p>
            <p className="text-xs text-white/40 mb-4">Budget left: €{opener.budget} - max legal bid: €{maxLegalBid(opener)}</p>

            <div className="flex items-center justify-center gap-3 mb-6">
              <button
                onClick={() => setOpenBidInput((b) => Math.max(1, b - 1))}
                className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20 transition"
              >
                <CaretLeft weight="bold" />
              </button>
              <span className="font-display text-3xl font-bold text-white w-16 text-center">€{openBidInput}</span>
              <button
                onClick={() => setOpenBidInput((b) => Math.min(maxLegalBid(opener), b + 1))}
                className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20 transition"
              >
                <CaretRight weight="bold" />
              </button>
            </div>

            <button
              onClick={openBidding}
              className="w-full rounded-xl bg-orange-glow px-4 py-3 text-sm font-bold text-ink-950 hover:brightness-110 transition inline-flex items-center justify-center gap-2"
            >
              <Gavel weight="fill" /> Open at €{openBidInput}
            </button>
          </div>
          <TeamsPanel teams={teams} activeIndex={openerIndex} />
        </div>
      </div>
    )
  }

  if (phase === 'auction') {
    const activeIndex = turnIndex ?? leaderIndex
    return (
      <div className="mx-auto max-w-4xl">
        <TeamsBar teams={teams} activeIndex={activeIndex} leaderIndex={leaderIndex} />
        <div className="lg:grid lg:grid-cols-[minmax(0,24rem)_1fr] lg:items-start lg:gap-10">
          <div className="mx-auto w-full max-w-sm text-center">
            <PlayerIdentity name={currentPlayer.name} club={currentPlayer.club} crestUrl={currentPlayer.club_crest_url} />

            <div className="glass-card rounded-2xl p-4 my-5">
              <p className="text-xs text-white/50">Current bid</p>
              <p className="font-display text-4xl font-bold text-orange-glow">€{currentBid}</p>
              <p className="text-sm text-white/70 mt-1">
                Leading: <span className="text-white font-semibold">{teams[leaderIndex]?.name}</span>
              </p>
            </div>

            {turnTeam ? (
              <>
                <p className="text-sm text-white mb-2">
                  <span className="text-orange-glow font-bold">{turnTeam.name}</span>'s turn
                </p>
                <p className="text-xs text-white/40 mb-3">
                  Budget: €{turnTeam.budget} - max bid: €{maxLegalBid(turnTeam)}
                </p>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <button
                    onClick={() => setBidInput((b) => Math.max(currentBid + 1, b - 1))}
                    className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20 transition"
                  >
                    <CaretLeft weight="bold" />
                  </button>
                  <span className="font-display text-3xl font-bold text-white w-16 text-center">€{bidInput}</span>
                  <button
                    onClick={() => setBidInput((b) => Math.min(maxLegalBid(turnTeam), b + 1))}
                    className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20 transition"
                  >
                    <CaretRight weight="bold" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-6">
                  <button
                    onClick={passTurn}
                    className="rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition"
                  >
                    Pass
                  </button>
                  <button
                    onClick={confirmBid}
                    className="rounded-xl bg-orange-glow px-3 py-2.5 text-sm font-bold text-ink-950 hover:brightness-110 transition"
                  >
                    Bid €{bidInput}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs text-white/40 mb-4">Everyone else has passed.</p>
            )}

            {!turnTeam && (
              <button
                onClick={sellToLeader}
                className="w-full rounded-xl bg-orange-glow px-4 py-3 text-sm font-bold text-ink-950 hover:brightness-110 transition"
              >
                Sold to {teams[leaderIndex]?.name} for €{currentBid}!
              </button>
            )}
          </div>
          <TeamsPanel teams={teams} activeIndex={activeIndex} />
        </div>
      </div>
    )
  }

  const stats = teams.map((t) => ({
    name: t.name,
    roster: t.roster,
    goals: t.roster.reduce((s, p) => s + (p.career_goals ?? 0), 0),
    assists: t.roster.reduce((s, p) => s + (p.career_assists ?? 0), 0),
    value: t.roster.reduce((s, p) => s + (p.market_value_eur ?? 0), 0),
    spent: BUDGET - t.budget,
  }))

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="font-display text-3xl font-bold text-white mb-1 text-center">Draft Complete!</h2>
      <p className="text-sm text-white/50 mb-6 text-center">No winner declared - compare and argue it out.</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {stats.map((t) => (
          <div key={t.name} className="glass-card rounded-2xl p-5">
            <h3 className="font-display text-lg font-bold text-white mb-1">{t.name}</h3>
            <p className="text-xs text-white/40 mb-3">€{t.spent}/{BUDGET} spent</p>
            <ul className="text-sm text-white/70 space-y-1 mb-4">
              {t.roster.map((p) => (
                <li key={p.id} className="truncate">{p.name}</li>
              ))}
            </ul>
            <div className="grid grid-cols-3 gap-2 text-center border-t border-white/10 pt-3">
              <div>
                <p className="font-display text-lg font-bold text-orange-glow">{t.goals}</p>
                <p className="text-[10px] text-white/40">Goals</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-orange-glow">{t.assists}</p>
                <p className="text-[10px] text-white/40">Assists</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-orange-glow inline-flex items-center gap-0.5 justify-center">
                  <Coins weight="fill" size={14} />€{Math.round(t.value / 1_000_000)}M
                </p>
                <p className="text-[10px] text-white/40">Value</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={playAgain}
        className="w-full rounded-xl bg-orange-glow px-4 py-3 text-sm font-bold text-ink-950 hover:brightness-110 transition"
      >
        New Draft
      </button>
    </div>
  )
}
