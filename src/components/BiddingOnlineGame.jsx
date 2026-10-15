import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Crown, ShareNetwork } from '@phosphor-icons/react'
import BiddingMatch from './BiddingMatch'
import { ChatDock, RoomChat } from './RoomChat'
import { supabase } from '../lib/supabaseClient'
import { botDecide, botDelay } from '../lib/biddingBot'
import { actorOf, applyAction, createGame } from '../lib/biddingEngine'
import { cleanName, tabId } from '../lib/bwIdentity'
import { containsProfanity } from '../lib/profanity'

const TURN_SECONDS = 25 // time for one decision; when it runs out the host passes (or opens at the lowest bid) for the player
const GRACE_MS = 9000 // how long a player may be away before a bot takes his seat
const WAIT_FOR_OPPONENT_MS = 14000
const MAX_PLAYERS = 4

/**
 * An online Bidding War: 2-4 players, each on his own device.
 *   mode 'room'   friends: the host creates a room, others join with the code or a link, the host starts the game; the room has a chat
 *   mode 'quick'  two strangers, starts by itself, no chat
 * The host (the one who created the room / the older searcher) is the referee: the others send what they want to do, the host checks it with
 * the same rules, numbers the action and tells everybody. Everything is replayed from the seed + the numbered list of actions, so a device that
 * reconnects simply asks for the list again. If a player disappears for a few seconds, the host lets a bot take his seat.
 */
export default function BiddingOnlineGame({ code, role, playerName, mode = 'room', onLeave, onBotFrom, onLost }) {
  const host = role === 'host'
  const myKey = useMemo(() => tabId(), [])
  const [phase, setPhase] = useState('connecting') // connecting | lobby | playing | hostleft | notfound | full | busy
  const [players, setPlayers] = useState([]) // everybody in the room right now
  const [state, setState] = useState(null)
  const [botSeats, setBotSeats] = useState([])
  const [seatsView, setSeatsView] = useState({ seats: [], names: [] })
  const [timeLeft, setTimeLeft] = useState(null)
  const [copied, setCopied] = useState(false)
  const [rematchKeys, setRematchKeys] = useState([])
  const [messages, setMessages] = useState([])

  const chRef = useRef(null)
  const stateRef = useRef(null)
  const playersRef = useRef([])
  const game = useRef({ seed: null, seats: [], names: [], bots: new Set(), log: [] })
  const turnStart = useRef(Date.now())
  const hostSeen = useRef(false)
  const rematchRef = useRef(new Set())
  const lastChat = useRef(0)

  const send = useCallback((event, payload = {}) => chRef.current?.send({ type: 'broadcast', event, payload }), [])

  const begin = useCallback((seed, seats, names, bots = [], log = []) => {
    game.current = { seed, seats, names, bots: new Set(bots), log: [] }
    let s = createGame({ names, seed })
    for (const a of log) {
      const n = applyAction(s, a)
      if (n) { s = n; game.current.log.push(a) }
    }
    stateRef.current = s
    turnStart.current = Date.now()
    rematchRef.current = new Set()
    setRematchKeys([])
    setSeatsView({ seats, names })
    setBotSeats([...bots])
    setState(s)
    setPhase(seats.includes(myKey) ? 'playing' : 'busy')
  }, [myKey])

  // host: apply an action, number it, tell the others
  const hostApply = useCallback((action) => {
    const s = applyAction(stateRef.current, action)
    if (!s) return false
    game.current.log.push(action)
    stateRef.current = s
    turnStart.current = Date.now()
    setState(s)
    send('act', { n: game.current.log.length, action })
    return true
  }, [send])

  const startGame = useCallback((list) => {
    const chosen = list.slice(0, MAX_PLAYERS)
    const seed = Math.floor(Math.random() * 2 ** 31)
    const seats = chosen.map((p) => p.key)
    const names = chosen.map((p, i) => cleanName(p.name, i === 0 ? 'Host' : `Guest ${i}`))
    begin(seed, seats, names)
    send('start', { seed, seats, names, bots: [] })
  }, [begin, send])

  // ---- connection ------------------------------------------------------------------------------------------------------------------
  useEffect(() => {
    if (!supabase) return undefined
    let ch = null
    let waitTimer = null
    let hostGoneTimer = null
    let closed = false
    const seatTimers = new Map()
    const joinedAt = Date.now()

    const connect = () => {
      ch = supabase.channel(`bw:${code}`, { config: { broadcast: { self: false }, presence: { key: myKey } } })
      chRef.current = ch

      ch.on('broadcast', { event: 'start' }, ({ payload }) => { if (!host) begin(payload.seed, payload.seats, payload.names.map((n) => cleanName(n)), payload.bots) })
      ch.on('broadcast', { event: 'log' }, ({ payload }) => { if (!host) begin(payload.seed, payload.seats, payload.names.map((n) => cleanName(n)), payload.bots, payload.log) })
      ch.on('broadcast', { event: 'sync' }, () => {
        const g = game.current
        if (host && g.seed !== null) send('log', { seed: g.seed, seats: g.seats, names: g.names, bots: [...g.bots], log: g.log })
      })
      ch.on('broadcast', { event: 'intent' }, ({ payload }) => {
        const g = game.current
        if (!host || !stateRef.current) return
        const seat = g.seats.indexOf(payload.from)
        if (seat >= 0 && actorOf(stateRef.current) === seat && !g.bots.has(seat)) hostApply(payload.action)
      })
      ch.on('broadcast', { event: 'act' }, ({ payload }) => {
        if (host || !stateRef.current) return
        const have = game.current.log.length
        if (payload.n === have + 1) {
          const s = applyAction(stateRef.current, payload.action)
          if (s) {
            game.current.log.push(payload.action)
            stateRef.current = s
            turnStart.current = Date.now()
            setState(s)
          }
        } else if (payload.n > have + 1) send('sync')
      })
      ch.on('broadcast', { event: 'bot' }, ({ payload }) => {
        game.current.bots.add(payload.seat)
        setBotSeats([...game.current.bots])
      })
      ch.on('broadcast', { event: 'rematch' }, ({ payload }) => {
        rematchRef.current.add(payload.from)
        setRematchKeys([...rematchRef.current])
      })
      ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
        const text = String(payload.text ?? '').slice(0, 200)
        const who = playersRef.current.find((p) => p.key === payload.from)
        setMessages((m) => [...m.slice(-59), { id: `${payload.from}-${payload.t}`, key: payload.from, name: who?.name ?? 'Guest', text: containsProfanity(text) ? '…' : text }])
      })

      ch.on('presence', { event: 'sync' }, () => {
        const list = Object.entries(ch.presenceState())
          .map(([key, metas]) => ({ key, name: cleanName(metas[0]?.name, 'Guest'), role: metas[0]?.role, at: metas[0]?.at ?? 0 }))
          .sort((a, b) => a.at - b.at || a.key.localeCompare(b.key))
        playersRef.current = list
        setPlayers(list)
        const g = game.current
        const present = new Set(list.map((p) => p.key))
        const hostHere = list.some((p) => p.role === 'host')
        if (hostHere) {
          hostSeen.current = true
          clearTimeout(waitTimer); waitTimer = null
        }
        if (g.seed === null) {
          // the game has not started yet
          if (!hostHere) return
          if (!host) {
            if (list.findIndex((p) => p.key === myKey) >= MAX_PLAYERS) setPhase('full')
            else { setPhase((p) => (p === 'connecting' ? 'lobby' : p)); send('sync') }
            return
          }
          setPhase((p) => (p === 'connecting' ? 'lobby' : p))
          if (mode === 'quick' && list.length >= 2) startGame(list)
          return
        }
        // the game is running
        if (host) {
          g.seats.forEach((key, seat) => {
            if (present.has(key) || g.bots.has(seat)) { clearTimeout(seatTimers.get(key)); seatTimers.delete(key); return }
            if (seatTimers.has(key) || key === myKey) return
            seatTimers.set(key, setTimeout(() => {
              seatTimers.delete(key)
              if (closed || g.bots.has(seat)) return
              g.bots.add(seat)
              setBotSeats([...g.bots])
              send('bot', { seat })
            }, GRACE_MS))
          })
        } else if (!hostHere) {
          if (!hostGoneTimer) hostGoneTimer = setTimeout(() => !closed && setPhase('hostleft'), GRACE_MS)
        } else {
          clearTimeout(hostGoneTimer); hostGoneTimer = null
          setPhase((p) => (p === 'hostleft' ? 'playing' : p))
        }
      })

      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ name: playerName, role, at: joinedAt })
          // nobody there after a while: a room waits for friends without limit; a quick match / an old link gives up
          waitTimer = setTimeout(() => {
            if (closed || hostSeen.current) return
            if (!host) setPhase('notfound')
            else if (mode === 'quick') onLost?.()
          }, WAIT_FOR_OPPONENT_MS)
        }
      })
    }
    // a moment later, so a quick unmount/mount (React development mode) does not tear down the fresh subscription of the same topic
    const startId = setTimeout(connect, 120)
    return () => {
      closed = true
      clearTimeout(startId)
      clearTimeout(waitTimer)
      clearTimeout(hostGoneTimer)
      for (const t of seatTimers.values()) clearTimeout(t)
      chRef.current = null
      if (ch) supabase.removeChannel(ch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, role])

  // ---- host: confirm the sale, bots, and the clock for every decision --------------------------------------------------------------------
  useEffect(() => {
    if (!host || !state) return undefined
    const actor = actorOf(state)
    if (actor === 'sell') {
      const id = setTimeout(() => hostApply({ type: 'sell' }), 900)
      return () => clearTimeout(id)
    }
    if (typeof actor === 'number') {
      if (botSeats.includes(actor)) {
        const id = setTimeout(() => {
          if (stateRef.current && actorOf(stateRef.current) === actor) hostApply(botDecide(stateRef.current))
        }, botDelay())
        return () => clearTimeout(id)
      }
      const id = setTimeout(() => hostApply(state.phase === 'opening' ? { type: 'open', amount: 1 } : { type: 'pass' }), TURN_SECONDS * 1000)
      return () => clearTimeout(id)
    }
    return undefined
  }, [host, state, botSeats, hostApply])

  // everybody: the countdown shown next to "Your turn"
  useEffect(() => {
    if (!state || typeof actorOf(state) !== 'number') { setTimeLeft(null); return undefined }
    const tick = () => setTimeLeft(Math.max(0, TURN_SECONDS - Math.floor((Date.now() - turnStart.current) / 1000)))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [state])

  const mySeat = seatsView.seats.indexOf(myKey)
  // the screen shows you as "You" and a seat taken over by a bot as "(Bot)"
  const view = useMemo(() => {
    if (!state) return null
    return { ...state, teams: state.teams.map((t, i) => (i === mySeat ? { ...t, name: 'You' } : botSeats.includes(i) ? { ...t, name: `${t.name} (Bot)` } : t)) }
  }, [state, mySeat, botSeats])

  function onAction(action) {
    if (!stateRef.current || actorOf(stateRef.current) !== mySeat) return
    if (host) hostApply(action)
    else send('intent', { from: myKey, action })
  }

  // players who are really there (no bot seat): for the rematch
  const humans = seatsView.seats.filter((key, i) => !botSeats.includes(i) && players.some((p) => p.key === key))
  useEffect(() => {
    if (!host || !state || state.phase !== 'done' || humans.length === 0) return
    if (humans.every((k) => rematchKeys.includes(k))) {
      const g = game.current
      const seed = Math.floor(Math.random() * 2 ** 31)
      begin(seed, g.seats, g.names, [...g.bots])
      send('start', { seed, seats: g.seats, names: g.names, bots: [...g.bots] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rematchKeys, host, state?.phase])

  function onRematch() {
    if (rematchRef.current.has(myKey)) return
    rematchRef.current.add(myKey)
    setRematchKeys([...rematchRef.current])
    send('rematch', { from: myKey })
  }

  function sendChat(text) {
    const now = Date.now()
    if (now - lastChat.current < 800) return
    if (containsProfanity(text)) {
      setMessages((m) => [...m.slice(-59), { id: `local-${now}`, key: 'system', name: 'TopBin', text: 'That message was not sent (language).' }])
      return
    }
    lastChat.current = now
    setMessages((m) => [...m.slice(-59), { id: `${myKey}-${now}`, key: myKey, name: 'You', text }])
    send('chat', { from: myKey, text, t: now })
  }

  const link = typeof window !== 'undefined' ? `${window.location.origin}/game/bidding-war?join=${code}` : ''
  async function share() {
    try {
      if (navigator.share) { await navigator.share({ title: 'Bidding War', text: 'Join my Bidding War room!', url: link }); return }
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* cancelled */ }
  }

  if (!supabase) return <Notice title="Online play is not available" text="This needs the online service." onLeave={onLeave} />
  if (phase === 'notfound') return <Notice title="Room not found" text="The code may be wrong, or the room is closed." onLeave={onLeave} />
  if (phase === 'full') return <Notice title="This room is full" text={`A room has room for ${MAX_PLAYERS} players.`} onLeave={onLeave} />
  if (phase === 'busy') return <Notice title="The game has already started" text="Ask the host for the next round." onLeave={onLeave} />

  // ---- waiting room -------------------------------------------------------------------------------------------------------------------
  if (phase === 'connecting' || phase === 'lobby') {
    if (mode === 'quick') {
      return (
        <div className="mx-auto max-w-sm pt-10 text-center">
          <p className="text-white/70 text-lg"><Dots /> {host ? 'Opponent found - starting' : 'Joining the game'}</p>
          <button onClick={onLeave} className="mt-8 text-sm text-white/40 hover:text-white/70 transition">Cancel</button>
        </div>
      )
    }
    return (
      <div className="mx-auto max-w-sm pt-6 text-center">
        <h2 className="font-display text-2xl font-bold text-white mb-1">{host ? 'Your room' : 'Room'}</h2>
        <div className="glass-card rounded-2xl p-4 my-4">
          <p className="text-xs text-white/50 mb-1">Room code</p>
          <p className="font-display text-4xl font-bold tracking-[0.25em] text-orange-glow">{code}</p>
          <button onClick={share} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition">
            {copied ? <Check weight="bold" /> : navigator.share ? <ShareNetwork weight="fill" /> : <Copy weight="fill" />}
            {copied ? 'Link copied' : navigator.share ? 'Share link' : 'Copy link'}
          </button>
        </div>

        <p className="mb-2 text-left text-xs uppercase tracking-wide text-white/40">Players {players.length}/{MAX_PLAYERS}</p>
        <ul className="mb-4 space-y-1.5 text-left">
          {players.slice(0, MAX_PLAYERS).map((p) => (
            <li key={p.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white">
              <span className="truncate">{p.key === myKey ? 'You' : p.name}</span>
              {p.role === 'host' && <Crown weight="fill" className="text-orange-glow" size={16} aria-label="Host" />}
            </li>
          ))}
        </ul>

        {host ? (
          <button
            onClick={() => startGame(players)}
            disabled={players.length < 2}
            className="w-full rounded-2xl bg-orange-glow px-4 py-4 text-base font-bold text-ink-950 hover:brightness-110 active:scale-[0.99] transition disabled:opacity-40"
          >
            {players.length < 2 ? 'Waiting for players …' : `Start game with ${Math.min(players.length, MAX_PLAYERS)} players`}
          </button>
        ) : (
          <p className="text-sm text-white/55"><Dots /> {phase === 'connecting' ? 'Joining the room' : 'Waiting for the host to start'}</p>
        )}

        <div className="mt-6"><RoomChat messages={messages} onSend={sendChat} myKey={myKey} height="h-36" /></div>
        <button onClick={onLeave} className="mt-6 text-sm text-white/40 hover:text-white/70 transition">Leave room</button>
      </div>
    )
  }

  // ---- the game -------------------------------------------------------------------------------------------------------------------------
  const iAmReady = rematchKeys.includes(myKey)
  const actorNow = state ? actorOf(state) : null
  const waitingText = typeof actorNow === 'number' ? `${view.teams[actorNow]?.name} is ${botSeats.includes(actorNow) ? 'thinking' : 'bidding'}` : undefined
  return (
    <BiddingMatch
      state={view}
      me={mySeat}
      onAction={onAction}
      timeLeft={timeLeft}
      waitingText={waitingText}
      onAgain={onRematch}
      againLabel={iAmReady ? `Waiting for the others (${rematchKeys.length}/${humans.length})` : `Rematch${rematchKeys.length ? ` (${rematchKeys.length}/${humans.length} ready)` : ''}`}
      onLeave={onLeave}
      banner={
        phase === 'hostleft' ? (
          <div className="mx-auto mb-4 max-w-sm rounded-2xl border border-orange-glow/50 bg-orange-glow/10 p-4 text-center">
            <p className="text-sm font-semibold text-white">The host left the game</p>
            <button onClick={() => onBotFrom?.(stateRef.current, mySeat)} className="mt-3 w-full rounded-xl bg-orange-glow px-4 py-3 text-sm font-bold text-ink-950 hover:brightness-110 transition">
              Continue against bots
            </button>
          </div>
        ) : null
      }
    >
      {mode === 'room' && <ChatDock messages={messages} onSend={sendChat} myKey={myKey} />}
    </BiddingMatch>
  )
}

function Dots() {
  return (
    <span className="mr-1 inline-flex gap-1 align-middle" aria-hidden="true">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-glow" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-glow [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-glow [animation-delay:300ms]" />
    </span>
  )
}

function Notice({ title, text, onLeave }) {
  return (
    <div className="mx-auto max-w-sm pt-10 text-center">
      <h2 className="font-display text-2xl font-bold text-white mb-2">{title}</h2>
      <p className="text-sm text-white/55 mb-6">{text}</p>
      <button onClick={onLeave} className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20 transition">Back</button>
    </div>
  )
}
