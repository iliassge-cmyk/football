import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Calculator, CaretLeft, CaretRight, DeviceMobile, DoorOpen, Lightning, PlusCircle, UsersThree, X } from '@phosphor-icons/react'
import BiddingJoinRoom from './BiddingJoinRoom'
import BiddingQuickMatch from './BiddingQuickMatch'
import { ModeButton } from './BlindParts'
import GameIntroModal from './GameIntroModal'
import { DraftView, ResultView, catOf } from './HitParts'
import HitOnlineGame from './HitOnlineGame'
import { useAuth } from '../lib/AuthContext'
import { cleanName, guestName, isRoomCode, newRoomCode } from '../lib/bwIdentity'
import { ACTIVE_CATEGORIES, MAX_PLAYERS, drawRound, draftOrder } from '../lib/hitTheNumber'
import { PLAYER_COLORS } from '../lib/blindRanking'
import { isBackendConfigured } from '../lib/supabaseClient'

/** Everybody on one phone (1-4 players): a target, a snake draft of five footballers each, the closest sum wins. */
function LocalGame({ onBack }) {
  const [phase, setPhase] = useState('setup') // setup | draft | result
  const [count, setCount] = useState(2)
  const [names, setNames] = useState(['', '', '', ''])
  const [round, setRound] = useState(null) // { categoryId, target }
  const [teams, setTeams] = useState([])
  const [step, setStep] = useState(0) // how many picks have been made
  const [query, setQuery] = useState('')
  const label = (i) => names[i].trim() || `Player ${i + 1}`
  const labels = Array.from({ length: count }, (_, i) => label(i))
  const order = useMemo(() => draftOrder(count), [count])

  function begin(previousId = null) {
    setRound(drawRound(previousId))
    setTeams(Array.from({ length: count }, () => []))
    setStep(0)
    setQuery('')
    setPhase('draft')
  }
  function lockIn(p) {
    const who = order[step]
    setTeams(teams.map((t, i) => (i === who ? [...t, p] : t)))
    setQuery('')
    if (step + 1 >= order.length) setPhase('result')
    else setStep(step + 1)
  }

  if (phase === 'setup') {
    return (
      <div className="mx-auto max-w-md">
        <button onClick={onBack} className="mb-4 text-sm text-white/50 transition hover:text-white">‹ Modes</button>
        <h2 className="mb-1 font-display text-2xl font-bold text-white">Same phone</h2>
        <p className="mb-6 text-sm text-white/50">Draft five footballers each, pass the phone around.</p>
        <label className="mb-1 block text-sm text-white/70">Players on this phone</label>
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => setCount(Math.max(1, count - 1))} disabled={count <= 1} aria-label="Fewer players" className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:opacity-30">
            <CaretLeft weight="bold" />
          </button>
          <span className="w-10 text-center font-display text-2xl font-bold text-white">{count}</span>
          <button onClick={() => setCount(Math.min(MAX_PLAYERS, count + 1))} disabled={count >= MAX_PLAYERS} aria-label="More players" className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:opacity-30">
            <CaretRight weight="bold" />
          </button>
        </div>
        <div className="mb-6 space-y-2">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: PLAYER_COLORS[i] }} />
              <input
                value={names[i]}
                onChange={(e) => setNames(names.map((n, k) => (k === i ? e.target.value : n)))}
                placeholder={`Player ${i + 1}`}
                maxLength={16}
                className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-white placeholder:text-white/30 focus:border-orange-glow focus:outline-none"
              />
            </div>
          ))}
        </div>
        <button onClick={() => begin()} className="w-full rounded-2xl bg-orange-glow py-4 font-display text-xl font-bold text-ink-950 active:scale-[0.99]">
          Start
        </button>
      </div>
    )
  }

  const cat = catOf(round.categoryId)
  if (phase === 'draft') {
    return (
      <DraftView
        cat={cat}
        target={round.target}
        teams={teams}
        names={labels}
        activeSeat={order[step]}
        canPick
        onPick={lockIn}
        query={query}
        setQuery={setQuery}
      />
    )
  }
  return (
    <ResultView cat={cat} target={round.target} teams={teams} names={labels}>
      <div className="mt-7 space-y-2">
        <button onClick={() => begin(round.categoryId)} className="w-full rounded-2xl bg-orange-glow py-4 font-display text-xl font-bold text-ink-950 active:scale-[0.99]">
          Play again
        </button>
        <button onClick={() => setPhase('setup')} className="w-full rounded-2xl bg-white/10 py-3.5 font-semibold text-white active:scale-[0.99]">
          Change players
        </button>
        <button onClick={onBack} className="w-full py-2 text-sm text-white/40 hover:text-white/70">Menu</button>
      </div>
    </ResultView>
  )
}

/** Hit the Number: pick how to play, one tap each. */
export default function HitTheNumber() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const joinCode = (params.get('join') ?? '').toUpperCase()
  const myName = cleanName(profile?.username ?? guestName(), 'Guest')
  // menu | local | quick | join | online { code, role, kind: 'room' | 'quick', partner }
  const [mode, setMode] = useState(() => (isRoomCode(joinCode) ? { name: 'online', code: joinCode, role: 'guest', kind: 'room' } : { name: 'menu' }))
  const [ignore, setIgnore] = useState([])
  const [friendsOpen, setFriendsOpen] = useState(false)
  const toMenu = () => {
    if (params.has('join')) setParams({}, { replace: true })
    setMode({ name: 'menu' })
  }

  if (mode.name === 'local') return <LocalGame onBack={toMenu} />
  if (mode.name === 'join') return <BiddingJoinRoom onJoin={(code) => setMode({ name: 'online', code, role: 'guest', kind: 'room' })} onCancel={toMenu} />
  if (mode.name === 'quick') {
    return (
      <BiddingQuickMatch
        channel="htn-lobby"
        playerName={myName}
        ignore={ignore}
        waitText="Looking for someone to draft with"
        slowText="Nobody is online right now. We keep looking - or play on your own meanwhile."
        botLabel="Play on your own instead"
        onMatched={({ code, role, partner }) => setMode({ name: 'online', code, role, kind: 'quick', partner })}
        onBot={() => setMode({ name: 'local' })}
        onCancel={toMenu}
      />
    )
  }
  if (mode.name === 'online') {
    return (
      <HitOnlineGame
        key={mode.code}
        code={mode.code}
        role={mode.role}
        mode={mode.kind}
        playerName={myName}
        onLeave={toMenu}
        onLost={() => { setIgnore((l) => [...l, mode.partner]); setMode({ name: 'quick' }) }}
      />
    )
  }
  return (
    <div className="mx-auto max-w-md">
      <GameIntroModal gameKey="hit-the-number" title="Hit the Number">
        <p>A target number appears, like 240 career goals. Draft five footballers whose numbers add up to it - as close as you can.</p>
        <p>Take turns picking, every footballer can only be taken once. You never see the numbers until the end. Going over is fine, only the distance counts.</p>
      </GameIntroModal>
      <div className="mb-8 mt-2 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-glow text-ink-950">
          <Calculator weight="fill" size={26} />
        </span>
        <h1 className="font-display text-4xl font-extrabold text-white">Hit the Number</h1>
        <p className="mt-1 text-sm text-white/50">Five footballers, one target. Closest sum wins.</p>
      </div>
      <div className="space-y-3">
        <ModeButton primary icon={<DeviceMobile weight="fill" size={24} />} title="Same phone" subtitle="1-4 players, pass the phone around" onClick={() => setMode({ name: 'local' })} />
        {isBackendConfigured && (
          <>
            <ModeButton icon={<UsersThree weight="fill" size={24} />} title="Play with friends" subtitle="Online room for up to 4, with chat" onClick={() => setFriendsOpen(true)} />
            <ModeButton icon={<Lightning weight="fill" size={24} />} title="Quick match" subtitle="Draft against someone online" onClick={() => { setIgnore([]); setMode({ name: 'quick' }) }} />
          </>
        )}
      </div>
      <p className="mt-5 text-center text-xs text-white/35">The stat is drawn at random: {ACTIVE_CATEGORIES.map((c) => c.label).join(', ')}.</p>
      {friendsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" onClick={() => setFriendsOpen(false)}>
          <div className="glass-card relative w-full max-w-sm rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setFriendsOpen(false)} aria-label="Close" className="absolute right-3 top-3 text-white/50 transition-colors hover:text-white"><X size={20} weight="bold" /></button>
            <h3 className="mb-1 pr-6 font-display text-xl font-bold text-white">Play with friends</h3>
            <p className="mb-4 text-sm text-white/55">Up to 4 players, each on their own phone.</p>
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
