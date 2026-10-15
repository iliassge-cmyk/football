import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CaretLeft, CaretRight, DeviceMobile, DoorOpen, Gavel, Lightning, PlusCircle, Robot, UsersThree, X } from '@phosphor-icons/react'
import BiddingBotGame from './BiddingBotGame'
import BiddingJoinRoom from './BiddingJoinRoom'
import BiddingOnlineGame from './BiddingOnlineGame'
import BiddingQuickMatch from './BiddingQuickMatch'
import { BiddingResults, TeamsBar, TeamsPanel } from './biddingParts'
import GameIntroModal from './GameIntroModal'
import PlayerIdentity from './PlayerIdentity'
import { useAuth } from '../lib/AuthContext'
import { cleanName, guestName, isRoomCode, newRoomCode } from '../lib/bwIdentity'
import { isBackendConfigured } from '../lib/supabaseClient'
import { BUDGET, POOL, ROSTER_SIZE, maxLegalBid, nextOpener, nextTurn } from '../lib/biddingEngine'

const MIN_PLAYERS = 2
const MAX_PLAYERS = 4

function shuffled(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function ModeButton({ icon, title, subtitle, onClick, primary = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition active:scale-[0.99] ${
        primary ? 'border-orange-glow/60 bg-orange-glow/10 hover:bg-orange-glow/15' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
      }`}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${primary ? 'bg-orange-glow text-ink-950' : 'bg-white/10 text-white'}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block font-display text-lg font-bold text-white">{title}</span>
        <span className="block text-sm text-white/55">{subtitle}</span>
      </span>
    </button>
  )
}

function LocalGame({ onBack }) {
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

        <button onClick={onBack} className="mb-4 text-sm text-white/50 hover:text-white transition">‹ Modes</button>
        <h2 className="font-display text-2xl font-bold text-white mb-1">Same phone</h2>
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
          Each team: €{BUDGET} budget, {ROSTER_SIZE} players, field players only.
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

  return <BiddingResults teams={teams} onAgain={playAgain} />
}

/** Bidding War: pick how to play, one tap each. */
export default function BiddingWar() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const joinCode = (params.get('join') ?? '').toUpperCase()
  const myName = cleanName(profile?.username ?? guestName(), 'Guest')
  // menu | bot | local | quick | join | online { code, role, kind: 'room' | 'quick', partner } | botFrom { state, me }
  const [mode, setMode] = useState(() => (isRoomCode(joinCode) ? { name: 'online', code: joinCode, role: 'guest', kind: 'room' } : { name: 'menu' }))
  const [ignore, setIgnore] = useState([])
  const [friendsOpen, setFriendsOpen] = useState(false) // the pop-up "create or join a room"
  const toMenu = () => {
    if (params.has('join')) setParams({}, { replace: true })
    setMode({ name: 'menu' })
  }

  if (mode.name === 'bot') return <BiddingBotGame onLeave={toMenu} />
  if (mode.name === 'botFrom') return <BiddingBotGame initial={mode.state} me={mode.me} bots={mode.bots} onLeave={toMenu} />
  if (mode.name === 'local') return <LocalGame onBack={toMenu} />
  if (mode.name === 'join') return <BiddingJoinRoom onJoin={(code) => setMode({ name: 'online', code, role: 'guest', kind: 'room' })} onCancel={toMenu} />
  if (mode.name === 'quick') {
    return (
      <BiddingQuickMatch
        playerName={myName}
        ignore={ignore}
        onMatched={({ code, role, partner }) => setMode({ name: 'online', code, role, kind: 'quick', partner })}
        onBot={() => setMode({ name: 'bot' })}
        onCancel={toMenu}
      />
    )
  }
  if (mode.name === 'online') {
    return (
      <BiddingOnlineGame
        key={mode.code}
        code={mode.code}
        role={mode.role}
        mode={mode.kind}
        playerName={myName}
        onLeave={toMenu}
        onLost={() => { setIgnore((l) => [...l, mode.partner]); setMode({ name: 'quick' }) }}
        onBotFrom={(state, mySeat) => {
          const bots = state.teams.map((_, i) => i).filter((i) => i !== mySeat)
          setMode({ name: 'botFrom', me: mySeat, bots, state: { ...state, teams: state.teams.map((t, i) => (i === mySeat ? { ...t, name: 'You' } : { ...t, name: `${t.name} (Bot)` })) } })
        }}
      />
    )
  }
  return (
    <div className="mx-auto max-w-md">
      <GameIntroModal gameKey="bidding-war" title="Bidding War">
        <p>An auction draft. Each team gets a €20 budget to bid for 5 players.</p>
        <p>Who opens each auction rotates like a poker dealer button, then bidding goes around the table - raise by any amount you like, or pass. Once everyone else has passed, the highest bid wins.</p>
        <p>No single winner at the end - just a side-by-side team comparison to argue about with your friends.</p>
      </GameIntroModal>
      <h2 className="font-display text-2xl font-bold text-white mb-1">Bidding War</h2>
      <p className="text-sm text-white/50 mb-6">Bid for 5 players with a €20 budget. How do you want to play?</p>
      <div className="space-y-3">
        <ModeButton icon={<DeviceMobile weight="fill" size={24} />} title="Same phone" subtitle="2-4 players, pass the phone around" onClick={() => setMode({ name: 'local' })} />
        {isBackendConfigured && (
          <>
            <ModeButton icon={<UsersThree weight="fill" size={24} />} title="Play with friends" subtitle="Online room for up to 4, with chat" onClick={() => setFriendsOpen(true)} />
            <ModeButton icon={<Lightning weight="fill" size={24} />} title="Quick match" subtitle="1 vs 1 against someone online" onClick={() => { setIgnore([]); setMode({ name: 'quick' }) }} />
          </>
        )}
        <ModeButton primary icon={<Robot weight="fill" size={24} />} title="Play vs Bot" subtitle="Starts right away" onClick={() => setMode({ name: 'bot' })} />
      </div>
      {friendsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" onClick={() => setFriendsOpen(false)}>
          <div className="glass-card relative w-full max-w-sm rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setFriendsOpen(false)} aria-label="Close" className="absolute right-3 top-3 text-white/50 hover:text-white transition-colors"><X size={20} weight="bold" /></button>
            <h3 className="mb-1 pr-6 font-display text-xl font-bold text-white">Play with friends</h3>
            <p className="mb-4 text-sm text-white/55">Up to 4 players, each on his own phone.</p>
            <div className="space-y-3">
              <ModeButton primary icon={<PlusCircle weight="fill" size={24} />} title="Create a room" subtitle="You get a code to share" onClick={() => { setFriendsOpen(false); setMode({ name: 'online', code: newRoomCode(), role: 'host', kind: 'room' }) }} />
              <ModeButton icon={<DoorOpen weight="fill" size={24} />} title="Join a room" subtitle="Enter your friend's code" onClick={() => { setFriendsOpen(false); setMode({ name: 'join' }) }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
