import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DeviceMobile, DoorOpen, Lightning, ListNumbers, PlusCircle, UsersThree, X } from '@phosphor-icons/react'
import BiddingJoinRoom from './BiddingJoinRoom'
import BiddingQuickMatch from './BiddingQuickMatch'
import BlindOnlineGame from './BlindOnlineGame'
import { ModeButton, PassPhone, Play, Rankings, Setup } from './BlindParts'
import GameIntroModal from './GameIntroModal'
import { useAuth } from '../lib/AuthContext'
import { cleanName, guestName, isRoomCode, newRoomCode } from '../lib/bwIdentity'
import { PLAYER_COLORS, drawSequence } from '../lib/blindRanking'
import { isBackendConfigured } from '../lib/supabaseClient'

/** Everybody on one phone (1-4 players): topic and footballers, then each player ranks in turn, then the rankings are shown side by side. */
function LocalGame({ onBack }) {
  const [phase, setPhase] = useState('setup') // setup | pass | play | result
  const [round, setRound] = useState(null) // { category, length, names, pool, sequence }
  const [turn, setTurn] = useState(0)
  const [boards, setBoards] = useState([])

  function begin(config) {
    setRound({ ...config, sequence: drawSequence(config.pool, config.length) })
    setBoards([])
    setTurn(0)
    setPhase(config.names.length > 1 ? 'pass' : 'play')
  }
  function finish(board) {
    setBoards([...boards, board])
    if (turn + 1 < round.names.length) {
      setTurn(turn + 1)
      setPhase('pass')
    } else setPhase('result')
  }

  if (phase === 'setup' || !round) return <Setup onStart={begin} />
  if (phase === 'pass') return <PassPhone key={turn} name={round.names[turn]} color={PLAYER_COLORS[turn]} first={turn === 0} onReady={() => setPhase('play')} />
  if (phase === 'play') {
    return (
      <Play key={turn} category={round.category} name={round.names[turn]} color={PLAYER_COLORS[turn]} count={round.names.length} sequence={round.sequence} length={round.length} onFinish={finish} onQuit={() => setPhase('setup')} />
    )
  }
  return (
    <Rankings category={round.category} names={round.names} boards={boards} sequence={round.sequence}>
      <div className="mt-7 space-y-2">
        <button onClick={() => begin(round)} className="w-full rounded-2xl bg-orange-glow py-4 font-display text-xl font-bold text-ink-950 active:scale-[0.99]">
          Play again
        </button>
        <button onClick={() => setPhase('setup')} className="w-full rounded-2xl bg-white/10 py-3.5 font-semibold text-white active:scale-[0.99]">
          New topic
        </button>
        <button onClick={onBack} className="w-full py-2 text-sm text-white/40 hover:text-white/70">Menu</button>
      </div>
    </Rankings>
  )
}

/** Blind Ranking: pick how to play, one tap each. */
export default function BlindRanking() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const joinCode = (params.get('join') ?? '').toUpperCase()
  const myName = cleanName(profile?.username ?? guestName(), 'Guest')
  // menu | local | quick | join | online { code, role, kind: 'room' | 'quick', partner }
  const [mode, setMode] = useState(() => (isRoomCode(joinCode) ? { name: 'online', code: joinCode, role: 'guest', kind: 'room' } : { name: 'menu' }))
  const [ignore, setIgnore] = useState([])
  const [friendsOpen, setFriendsOpen] = useState(false) // the pop-up "create or join a room"
  const toMenu = () => {
    if (params.has('join')) setParams({}, { replace: true })
    setMode({ name: 'menu' })
  }

  if (mode.name === 'local') return <LocalGame onBack={toMenu} />
  if (mode.name === 'join') return <BiddingJoinRoom onJoin={(code) => setMode({ name: 'online', code, role: 'guest', kind: 'room' })} onCancel={toMenu} />
  if (mode.name === 'quick') {
    return (
      <BiddingQuickMatch
        channel="br-lobby"
        playerName={myName}
        ignore={ignore}
        waitText="Looking for someone to rank with"
        slowText="Nobody is online right now. We keep looking - or rank on your own meanwhile."
        botLabel="Rank on your own instead"
        onMatched={({ code, role, partner }) => setMode({ name: 'online', code, role, kind: 'quick', partner })}
        onBot={() => setMode({ name: 'local' })}
        onCancel={toMenu}
      />
    )
  }
  if (mode.name === 'online') {
    return (
      <BlindOnlineGame
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
      <GameIntroModal gameKey="blind-ranking" title="Blind Ranking">
        <p>A footballer appears. Put him on a rank right away - you don't know who comes next, and there is no going back.</p>
        <p>Pick any topic you like. When everyone is done, the rankings are shown side by side. No points, no winner - argue about who ranked better.</p>
      </GameIntroModal>
      <div className="mb-8 mt-2 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-glow text-ink-950">
          <ListNumbers weight="fill" size={26} />
        </span>
        <h1 className="font-display text-4xl font-extrabold text-white">Blind Ranking</h1>
        <p className="mt-1 text-sm text-white/50">Rank footballers one by one, blind. How do you want to play?</p>
      </div>
      <div className="space-y-3">
        <ModeButton primary icon={<DeviceMobile weight="fill" size={24} />} title="Same phone" subtitle="1-4 players, pass the phone around" onClick={() => setMode({ name: 'local' })} />
        {isBackendConfigured && (
          <>
            <ModeButton icon={<UsersThree weight="fill" size={24} />} title="Play with friends" subtitle="Online room for up to 4, with chat" onClick={() => setFriendsOpen(true)} />
            <ModeButton icon={<Lightning weight="fill" size={24} />} title="Quick match" subtitle="Rank with someone online, random topic" onClick={() => { setIgnore([]); setMode({ name: 'quick' }) }} />
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
