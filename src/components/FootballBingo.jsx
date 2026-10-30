import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CaretLeft, CaretRight, DeviceMobile, DoorOpen, Lightning, PlusCircle, Shuffle, SquaresFour, UsersThree, X } from '@phosphor-icons/react'
import BiddingJoinRoom from './BiddingJoinRoom'
import BiddingQuickMatch from './BiddingQuickMatch'
import BingoOnline from './BingoOnline'
import { BingoBoard, GuessSheet, TurnBar, Verdict } from './BingoParts'
import { ModeButton } from './BlindParts'
import GameIntroModal from './GameIntroModal'
import ShareResult from './ShareResult'
import { useAuth } from '../lib/AuthContext'
import { cleanName, guestName, isRoomCode, newRoomCode } from '../lib/bwIdentity'
import { PLAYER_COLORS } from '../lib/blindRanking'
import { randomGrid } from '../lib/bingo'
import { applyMove, isOver, livesFor, newGame } from '../lib/bingoGame'
import { isBackendConfigured } from '../lib/supabaseClient'

/** One phone, 1-4 players: a random grid, the players take turns naming a footballer for a field. */
function LocalGame({ onBack }) {
  const [phase, setPhase] = useState('setup') // setup | play
  const [count, setCount] = useState(2)
  const [names, setNames] = useState(['', '', '', ''])
  const [grid, setGrid] = useState(null)
  const [game, setGame] = useState(null)
  const [open, setOpen] = useState(null)
  const [note, setNote] = useState('')
  const labels = Array.from({ length: count }, (_, i) => names[i].trim() || (count === 1 ? 'You' : `Player ${i + 1}`))

  function begin() {
    setGrid(randomGrid())
    setGame(newGame(count))
    setOpen(null)
    setNote('')
    setPhase('play')
  }
  function guess(p) {
    const next = applyMove(game, grid, { seat: game.seat, cell: open, id: p.id })
    if (!next) return
    setNote(next.last.hit ? '' : `${p.name} does not fit - ${labels[game.seat]} loses a life.`)
    setGame(next)
    setOpen(null)
  }

  if (phase === 'setup') {
    return (
      <div className="mx-auto max-w-md">
        <button onClick={onBack} className="mb-4 text-sm text-white/50 transition hover:text-white">‹ Modes</button>
        <h2 className="mb-1 font-display text-2xl font-bold text-white">Same phone</h2>
        <p className="mb-6 text-sm text-white/50">Alone or with up to 3 friends - a new random grid every game.</p>
        <label className="mb-1 block text-sm text-white/70">Players on this phone</label>
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => setCount(Math.max(1, count - 1))} disabled={count <= 1} aria-label="Fewer players" className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:opacity-30"><CaretLeft weight="bold" /></button>
          <span className="w-10 text-center font-display text-2xl font-bold text-white">{count}</span>
          <button onClick={() => setCount(Math.min(4, count + 1))} disabled={count >= 4} aria-label="More players" className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:opacity-30"><CaretRight weight="bold" /></button>
        </div>
        <div className="mb-6 space-y-2">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: PLAYER_COLORS[i] }} />
              <input value={names[i]} onChange={(e) => setNames(names.map((n, k) => (k === i ? e.target.value : n)))} placeholder={count === 1 ? 'You' : `Player ${i + 1}`} maxLength={16} className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-white placeholder:text-white/30 focus:border-orange-glow focus:outline-none" />
            </div>
          ))}
        </div>
        <button onClick={begin} className="w-full rounded-2xl bg-orange-glow py-4 font-display text-xl font-bold text-ink-950 active:scale-[0.99]">Start</button>
        <p className="mt-3 text-center text-xs text-white/35">{livesFor(count)} lives each. A wrong footballer costs one.</p>
      </div>
    )
  }

  const over = isOver(game)
  const shareLines = [`Football Bingo - ${game.cells.filter(Boolean).length}/9`, ...[0, 1, 2].map((r) => [0, 1, 2].map((c) => (game.cells[r * 3 + c] ? '🟩' : '⬛')).join(''))]
  return (
    <div className="mx-auto max-w-md pb-10">
      <TurnBar state={game} names={labels} />
      <BingoBoard grid={grid} state={game} names={labels} onCell={over ? null : (i) => { setOpen(i); setNote('') }} lastCell={game.last?.hit ? game.last.cell : -1} />
      {note && <p className="mt-3 text-center text-sm text-red-300">{note}</p>}
      {!over && game.moves === 0 && (
        <button onClick={begin} className="mx-auto mt-4 flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"><Shuffle weight="bold" /> Shuffle the categories</button>
      )}
      {!over && <p className="mt-3 text-center text-xs text-white/40">{labels[game.seat]}: tap a field and name a footballer who fits both categories.</p>}
      {over && (
        <div className="mt-6 text-center">
          <Verdict state={game} names={labels} />
          {count === 1 && <div className="mb-3"><ShareResult gameName="Football Bingo" lines={shareLines} /></div>}
          <div className="space-y-2">
            <button onClick={begin} className="w-full rounded-2xl bg-orange-glow py-4 font-display text-xl font-bold text-ink-950 active:scale-[0.99]">New random grid</button>
            <button onClick={() => setPhase('setup')} className="w-full rounded-2xl bg-white/10 py-3.5 font-semibold text-white active:scale-[0.99]">Change players</button>
            <button onClick={onBack} className="w-full py-2 text-sm text-white/40 hover:text-white/70">Menu</button>
          </div>
        </div>
      )}
      {open != null && <GuessSheet grid={grid} cell={open} used={game.used} onGuess={guess} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** Football Bingo: pick how to play, one tap each. */
export default function FootballBingo() {
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
        channel="fb-lobby"
        playerName={myName}
        ignore={ignore}
        waitText="Looking for someone to play bingo with"
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
      <BingoOnline
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
      <GameIntroModal gameKey="football-bingo" title="Football Bingo">
        <p>A random 3x3 grid: every field sits between two categories - a club, a nation, a title or a coach. Name a footballer who fits both (he played for the club, has the nationality, won the title, played under the coach).</p>
        <p>With friends you take turns and the fields you win are yours. Every footballer can only be used once, a wrong one costs a life. Most fields win. Every game has a new grid.</p>
      </GameIntroModal>
      <div className="mb-8 mt-2 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-glow text-ink-950"><SquaresFour weight="fill" size={26} /></span>
        <h1 className="font-display text-4xl font-extrabold text-white">Football Bingo</h1>
        <p className="mt-1 text-sm text-white/50">Fill the grid with footballers that fit both categories.</p>
      </div>
      <div className="space-y-3">
        <ModeButton primary icon={<DeviceMobile weight="fill" size={24} />} title="Same phone" subtitle="Alone or 2-4 players, pass the phone around" onClick={() => setMode({ name: 'local' })} />
        {isBackendConfigured && (
          <>
            <ModeButton icon={<UsersThree weight="fill" size={24} />} title="Play with friends" subtitle="Online room for up to 4, with chat" onClick={() => setFriendsOpen(true)} />
            <ModeButton icon={<Lightning weight="fill" size={24} />} title="Quick match" subtitle="Play against someone online" onClick={() => { setIgnore([]); setMode({ name: 'quick' }) }} />
          </>
        )}
      </div>
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
