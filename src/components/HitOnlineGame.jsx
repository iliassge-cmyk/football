import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Crown, ShareNetwork } from '@phosphor-icons/react'
import { Dots, Notice } from './BlindOnlineGame'
import { DraftView, ResultView, catOf } from './HitParts'
import { ChatDock, RoomChat } from './RoomChat'
import { supabase } from '../lib/supabaseClient'
import { cleanName, tabId } from '../lib/bwIdentity'
import { containsProfanity } from '../lib/profanity'
import { MAX_PLAYERS, drawRound, draftOrder } from '../lib/hitTheNumber'
import { PLAYER_COLORS } from '../lib/blindRanking'

const GRACE_MS = 9000 // how long a player may be away before his picks are skipped
const WAIT_FOR_OPPONENT_MS = 14000

/** What arrives from another device is checked before it is used. */
function parseConfig(p) {
  if (!p || !Array.isArray(p.seats) || !Array.isArray(p.names)) return null
  const cat = catOf(String(p.categoryId))
  const target = Number(p.target)
  const seats = p.seats.filter((k) => typeof k === 'string').slice(0, MAX_PLAYERS)
  if (!cat || !Number.isInteger(target) || target < 1 || target > 5000 || !seats.length) return null
  return { categoryId: cat.id, target, seats, names: seats.map((_, i) => cleanName(p.names[i], `Player ${i + 1}`)) }
}

/**
 * An online Hit the Number, everybody on their own device. The draft is a shared log of picks: pick number n may only be made by the player whose turn it
 * is (snake order), and every device accepts it only when it is exactly the next one - so all devices see the same teams. The host starts the round and
 * skips the turns of a player who has left.
 */
export default function HitOnlineGame({ code, role, playerName, mode = 'room', onLeave, onLost }) {
  const host = role === 'host'
  const myKey = useMemo(() => tabId(), [])
  const [phase, setPhase] = useState('connecting') // connecting | lobby | playing | notfound | full | busy
  const [players, setPlayers] = useState([])
  const [config, setConfig] = useState(null)
  const [picks, setPicks] = useState([]) // [{ seat, id | null }] in the order they were made (id null = turn skipped)
  const [gone, setGone] = useState([])
  const [copied, setCopied] = useState(false)
  const [messages, setMessages] = useState([])
  const [query, setQuery] = useState('')

  const chRef = useRef(null)
  const playersRef = useRef([])
  const configRef = useRef(null)
  const picksRef = useRef([])
  const lastCat = useRef(null)
  const hostSeen = useRef(false)
  const lastChat = useRef(0)
  const send = useCallback((event, payload = {}) => chRef.current?.send({ type: 'broadcast', event, payload }), [])

  const setLog = useCallback((list) => { picksRef.current = list; setPicks(list) }, [])
  const begin = useCallback((cfg, known = []) => {
    configRef.current = cfg
    lastCat.current = cfg.categoryId
    setConfig(cfg)
    setGone([])
    setLog([])
    for (const pk of known) applyPick(pk.seat, pk.id)
    setQuery('')
    setPhase(cfg.seats.includes(myKey) ? 'playing' : 'busy')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myKey, setLog])

  /** Adds the next pick of the log when it is legal (right seat, a footballer of the category, not taken yet). Returns whether it was added. */
  function applyPick(seat, id) {
    const cfg = configRef.current
    if (!cfg) return false
    const order = draftOrder(cfg.seats.length)
    const n = picksRef.current.length
    if (n >= order.length || order[n] !== seat) return false
    if (id !== null) {
      const cat = catOf(cfg.categoryId)
      if (!cat.pool.some((p) => p.id === id) || picksRef.current.some((pk) => pk.id === id)) return false
    }
    setLog([...picksRef.current, { seat, id }])
    return true
  }

  const hostStart = useCallback(() => {
    const here = playersRef.current.slice(0, MAX_PLAYERS)
    const cfg = { ...drawRound(lastCat.current), seats: here.map((p) => p.key), names: here.map((p, i) => cleanName(p.name, i === 0 ? 'Host' : `Guest ${i}`)) }
    begin(cfg)
    send('start', cfg)
  }, [begin, send])

  function backToLobby() {
    configRef.current = null
    setConfig(null)
    setLog([])
    setGone([])
    setPhase('lobby')
    send('lobby')
  }

  // ---- connection ------------------------------------------------------------------------------------------------------------------
  useEffect(() => {
    if (!supabase) return undefined
    let ch = null
    let waitTimer = null
    let closed = false
    const leaveTimers = new Map()
    const joinedAt = Date.now()

    const connect = () => {
      ch = supabase.channel(`htn:${code}`, { config: { broadcast: { self: false }, presence: { key: myKey } } })
      chRef.current = ch

      ch.on('broadcast', { event: 'start' }, ({ payload }) => {
        const cfg = parseConfig(payload)
        if (cfg && !host) begin(cfg)
      })
      ch.on('broadcast', { event: 'lobby' }, () => {
        if (host) return
        configRef.current = null
        setConfig(null)
        setLog([])
        setGone([])
        setPhase('lobby')
      })
      ch.on('broadcast', { event: 'pick' }, ({ payload }) => {
        const cfg = configRef.current
        if (!cfg || !payload || payload.n !== picksRef.current.length) return
        const seat = cfg.seats.indexOf(payload.from)
        if (seat >= 0) applyPick(seat, String(payload.id))
      })
      ch.on('broadcast', { event: 'skip' }, ({ payload }) => {
        const cfg = configRef.current
        const hostKey = playersRef.current.find((p) => p.role === 'host')?.key
        if (!cfg || !payload || payload.from !== hostKey || payload.n !== picksRef.current.length) return
        applyPick(draftOrder(cfg.seats.length)[payload.n], null)
      })
      // somebody who (re)joins asks for the round that is running; everybody who knows it answers (the answer is harmless to repeat)
      ch.on('broadcast', { event: 'sync' }, () => {
        const cfg = configRef.current
        if (cfg) setTimeout(() => send('log', { ...cfg, picks: picksRef.current }), Math.random() * 250)
      })
      ch.on('broadcast', { event: 'log' }, ({ payload }) => {
        const cfg = parseConfig(payload)
        if (!cfg) return
        const known = Array.isArray(payload.picks) ? payload.picks.filter((x) => Number.isInteger(x?.seat) && (x.id === null || typeof x.id === 'string')) : []
        if (!configRef.current) { begin(cfg, known); return }
        // already in the round: only the picks that were missed are taken over
        for (const pk of known.slice(picksRef.current.length)) if (!applyPick(pk.seat, pk.id)) break
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
        const present = new Set(list.map((p) => p.key))
        const hostHere = list.some((p) => p.role === 'host')
        if (hostHere) { hostSeen.current = true; clearTimeout(waitTimer); waitTimer = null }
        const cfg = configRef.current
        if (!cfg) {
          if (!host && !hostHere) return
          if (!host && list.findIndex((p) => p.key === myKey) >= MAX_PLAYERS) { setPhase('full'); return }
          setPhase((p) => (p === 'connecting' ? 'lobby' : p))
          if (list.length > 1) send('sync') // a round may already be running (this device was reloaded)
          if (host && mode === 'quick' && list.length >= 2) hostStart()
          return
        }
        // a round is running: whoever stays away for a while is skipped
        cfg.seats.forEach((key) => {
          if (present.has(key)) { clearTimeout(leaveTimers.get(key)); leaveTimers.delete(key); setGone((g) => g.filter((k) => k !== key)); return }
          if (leaveTimers.has(key) || key === myKey) return
          leaveTimers.set(key, setTimeout(() => { leaveTimers.delete(key); if (!closed) setGone((g) => (g.includes(key) ? g : [...g, key])) }, GRACE_MS))
        })
      })

      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ name: playerName, role, at: joinedAt })
          waitTimer = setTimeout(() => {
            if (closed || hostSeen.current) return
            if (!host) setPhase('notfound')
            else if (mode === 'quick') onLost?.()
          }, WAIT_FOR_OPPONENT_MS)
        }
      })
    }
    const startId = setTimeout(connect, 120)
    return () => {
      closed = true
      clearTimeout(startId)
      clearTimeout(waitTimer)
      for (const t of leaveTimers.values()) clearTimeout(t)
      chRef.current = null
      if (ch) supabase.removeChannel(ch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, role])

  const cat = config ? catOf(config.categoryId) : null
  const order = useMemo(() => (config ? draftOrder(config.seats.length) : []), [config])
  const finished = Boolean(config && picks.length >= order.length)
  const turnSeat = config && !finished ? order[picks.length] : -1
  const myTurn = Boolean(config && !finished && config.seats[turnSeat] === myKey)

  // the host skips the turn of a player who has left (everybody else follows the 'skip')
  useEffect(() => {
    if (!host || !config || finished) return
    const key = config.seats[turnSeat]
    if (key !== myKey && gone.includes(key)) {
      const n = picksRef.current.length
      if (applyPick(turnSeat, null)) send('skip', { from: myKey, n })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gone, picks.length])

  const byId = useMemo(() => (cat ? new Map(cat.pool.map((p) => [p.id, p])) : new Map()), [cat])
  const teams = config ? config.seats.map((_, s) => picks.filter((pk) => pk.seat === s && pk.id).map((pk) => byId.get(pk.id)).filter(Boolean)) : []
  const names = config ? config.seats.map((k, i) => (k === myKey ? 'You' : config.names[i])) : []

  function lockIn(p) {
    if (!myTurn) return
    const n = picksRef.current.length
    if (applyPick(turnSeat, p.id)) send('pick', { from: myKey, n, id: p.id })
    setQuery('')
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

  const link = typeof window !== 'undefined' ? `${window.location.origin}/game/hit-the-number?join=${code}` : ''
  async function share() {
    try {
      if (navigator.share) { await navigator.share({ title: 'Hit the Number', text: 'Join my Hit the Number room!', url: link }); return }
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* cancelled */ }
  }

  if (!supabase) return <Notice title="Online play is not available" text="This needs the online service." onLeave={onLeave} />
  if (phase === 'notfound') return <Notice title="Room not found" text="The code may be wrong, or the room is closed." onLeave={onLeave} />
  if (phase === 'full') return <Notice title="This room is full" text={`A room has room for ${MAX_PLAYERS} players.`} onLeave={onLeave} />
  if (phase === 'busy') return <Notice title="The round has already started" text="Ask the host for the next round." onLeave={onLeave} />

  const dock = mode === 'room' ? <ChatDock messages={messages} onSend={sendChat} myKey={myKey} /> : null

  // ---- waiting room ----------------------------------------------------------------------------------------------------------------
  if (phase === 'connecting' || phase === 'lobby') {
    if (mode === 'quick') {
      return (
        <div className="mx-auto max-w-sm pt-10 text-center">
          <p className="text-lg text-white/70"><Dots /> {host ? 'Found someone - starting' : 'Joining the round'}</p>
          <button onClick={onLeave} className="mt-8 text-sm text-white/40 transition hover:text-white/70">Cancel</button>
        </div>
      )
    }
    return (
      <div className="mx-auto max-w-sm pt-6 text-center">
        <h2 className="mb-1 font-display text-2xl font-bold text-white">{host ? 'Your room' : 'Room'}</h2>
        <div className="glass-card my-4 rounded-2xl p-4">
          <p className="mb-1 text-xs text-white/50">Room code</p>
          <p className="font-display text-4xl font-bold tracking-[0.25em] text-orange-glow">{code}</p>
          <button onClick={share} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20">
            {copied ? <Check weight="bold" /> : navigator.share ? <ShareNetwork weight="fill" /> : <Copy weight="fill" />}
            {copied ? 'Link copied' : navigator.share ? 'Share link' : 'Copy link'}
          </button>
        </div>
        <p className="mb-2 text-left text-xs uppercase tracking-wide text-white/40">Players {players.length}/{MAX_PLAYERS}</p>
        <ul className="mb-6 space-y-1.5 text-left">
          {players.slice(0, MAX_PLAYERS).map((p, i) => (
            <li key={p.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PLAYER_COLORS[i] }} />
                <span className="truncate">{p.key === myKey ? 'You' : p.name}</span>
              </span>
              {p.role === 'host' && <Crown weight="fill" className="text-orange-glow" size={16} aria-label="Host" />}
            </li>
          ))}
        </ul>
        {host ? (
          <button
            onClick={hostStart}
            disabled={players.length < 2}
            className="w-full rounded-2xl bg-orange-glow py-4 font-display text-xl font-bold text-ink-950 active:scale-[0.99] disabled:opacity-40"
          >
            {players.length < 2 ? 'Waiting for players …' : `Start with ${Math.min(players.length, MAX_PLAYERS)} players`}
          </button>
        ) : (
          <p className="text-sm text-white/55"><Dots /> {phase === 'connecting' ? 'Joining the room' : 'Waiting for the host to start'}</p>
        )}
        <div className="mt-6"><RoomChat messages={messages} onSend={sendChat} myKey={myKey} height="h-36" /></div>
        <button onClick={onLeave} className="mt-6 text-sm text-white/40 transition hover:text-white/70">Leave room</button>
      </div>
    )
  }

  // ---- the round --------------------------------------------------------------------------------------------------------------------
  if (!config || !cat) return null
  if (!finished) {
    return (
      <>
        <DraftView
          cat={cat}
          target={config.target}
          teams={teams}
          names={names}
          activeSeat={turnSeat}
          canPick={myTurn}
          onPick={lockIn}
          query={query}
          setQuery={setQuery}
          banner={myTurn ? 'Your pick' : `${names[turnSeat]} picks`}
        />
        <div className="mx-auto max-w-md text-center"><button onClick={onLeave} className="mt-2 text-sm text-white/40 transition hover:text-white/70">Leave</button></div>
        {dock}
      </>
    )
  }
  return (
    <>
      <ResultView cat={cat} target={config.target} teams={teams} names={names}>
        <div className="mt-7 space-y-2">
          {host ? (
            <>
              <button onClick={hostStart} className="w-full rounded-2xl bg-orange-glow py-4 font-display text-xl font-bold text-ink-950 active:scale-[0.99]">Play again</button>
              {mode === 'room' && <button onClick={backToLobby} className="w-full rounded-2xl bg-white/10 py-3.5 font-semibold text-white active:scale-[0.99]">Back to the room</button>}
            </>
          ) : (
            <p className="text-center text-sm text-white/55"><Dots /> The host starts the next round</p>
          )}
          <button onClick={onLeave} className="w-full py-2 text-sm text-white/40 hover:text-white/70">Leave</button>
        </div>
      </ResultView>
      {dock}
    </>
  )
}

