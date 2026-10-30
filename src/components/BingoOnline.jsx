import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Crown, ShareNetwork } from '@phosphor-icons/react'
import { Dots, Notice } from './BlindOnlineGame'
import { BingoBoard, GuessSheet, TurnBar, Verdict } from './BingoParts'
import { ChatDock, RoomChat } from './RoomChat'
import { supabase } from '../lib/supabaseClient'
import { cleanName, tabId } from '../lib/bwIdentity'
import { containsProfanity } from '../lib/profanity'
import { categoryOf, randomGrid } from '../lib/bingo'
import { applyMove, isOver, newGame } from '../lib/bingoGame'
import { PLAYER_COLORS } from '../lib/blindRanking'

const MAX_PLAYERS = 4
const GRACE_MS = 9000 // how long a player may be away before his turns are skipped
const WAIT_FOR_OPPONENT_MS = 14000

const side = (cats) => cats.map((c) => ({ type: c.type, key: c.key }))
/** What arrives from another device is checked before it is used (null: not valid, or a category this version of the site does not know). */
function parseConfig(p) {
  if (!p || !Array.isArray(p.cols) || !Array.isArray(p.rows) || p.cols.length !== 3 || p.rows.length !== 3 || !Array.isArray(p.seats) || !Array.isArray(p.names)) return null
  const resolve = (list) => list.map((c) => categoryOf(String(c?.type), String(c?.key)))
  const cols = resolve(p.cols), rows = resolve(p.rows)
  const seats = p.seats.filter((k) => typeof k === 'string').slice(0, MAX_PLAYERS)
  if ([...cols, ...rows].some((c) => !c) || !seats.length) return null
  return { grid: { cols, rows }, seats, names: seats.map((_, i) => cleanName(p.names[i], `Player ${i + 1}`)) }
}
const wire = (cfg) => ({ cols: side(cfg.grid.cols), rows: side(cfg.grid.rows), seats: cfg.seats, names: cfg.names })

/**
 * An online Football Bingo, everybody on their own device. The game is a shared log of moves ({ seat, cell, id }): a move is only accepted when it is the next
 * one (number n) and made by the player whose turn it is, and the state is always replayed from the log - so every device sees the same board. The host starts
 * a round (a new random grid) and skips the turns of a player who has left.
 */
export default function BingoOnline({ code, role, playerName, mode = 'room', onLeave, onLost }) {
  const host = role === 'host'
  const myKey = useMemo(() => tabId(), [])
  const [phase, setPhase] = useState('connecting') // connecting | lobby | playing | notfound | full | busy | outdated
  const [players, setPlayers] = useState([])
  const [config, setConfig] = useState(null)
  const [log, setLog] = useState([])
  const [gone, setGone] = useState([])
  const [copied, setCopied] = useState(false)
  const [messages, setMessages] = useState([])
  const [open, setOpen] = useState(null)
  const [note, setNote] = useState('')

  const chRef = useRef(null)
  const playersRef = useRef([])
  const configRef = useRef(null)
  const logRef = useRef([])
  const hostSeen = useRef(false)
  const lastChat = useRef(0)
  const send = useCallback((event, payload = {}) => chRef.current?.send({ type: 'broadcast', event, payload }), [])
  const setMoves = useCallback((list) => { logRef.current = list; setLog(list) }, [])

  /** The state after all moves of the log. */
  const replay = (cfg, moves) => moves.reduce((s, m) => applyMove(s, cfg.grid, m) ?? s, newGame(cfg.seats.length))
  /** Appends a move when it is legal as the next one. */
  function accept(move) {
    const cfg = configRef.current
    if (!cfg) return false
    const next = applyMove(replay(cfg, logRef.current), cfg.grid, move)
    if (!next) return false
    setMoves([...logRef.current, move])
    return true
  }

  const begin = useCallback((cfg, known = []) => {
    configRef.current = cfg
    setConfig(cfg)
    setGone([])
    setMoves([])
    for (const m of known) accept(m)
    setOpen(null)
    setNote('')
    setPhase(cfg.seats.includes(myKey) ? 'playing' : 'busy')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myKey, setMoves])

  const hostStart = useCallback(() => {
    const here = playersRef.current.slice(0, MAX_PLAYERS)
    const grid = randomGrid()
    if (!grid) return
    const cfg = { grid, seats: here.map((p) => p.key), names: here.map((p, i) => cleanName(p.name, i === 0 ? 'Host' : `Guest ${i}`)) }
    begin(cfg)
    send('start', wire(cfg))
  }, [begin, send])

  function backToLobby() {
    configRef.current = null
    setConfig(null)
    setMoves([])
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
    const validMove = (m) => m && Number.isInteger(m.seat) && Number.isInteger(m.cell) && (m.id === null || typeof m.id === 'string')

    const connect = () => {
      ch = supabase.channel(`fb:${code}`, { config: { broadcast: { self: false }, presence: { key: myKey } } })
      chRef.current = ch

      ch.on('broadcast', { event: 'start' }, ({ payload }) => {
        const cfg = parseConfig(payload)
        if (!cfg) { if (!host) setPhase('outdated'); return }
        if (!host) begin(cfg)
      })
      ch.on('broadcast', { event: 'lobby' }, () => {
        if (host) return
        configRef.current = null
        setConfig(null)
        setMoves([])
        setGone([])
        setPhase('lobby')
      })
      ch.on('broadcast', { event: 'move' }, ({ payload }) => {
        const cfg = configRef.current
        if (!cfg || !payload || payload.n !== logRef.current.length || cfg.seats[payload.seat] !== payload.from) return
        const m = { seat: payload.seat, cell: payload.cell, id: payload.id ?? null }
        if (validMove(m) && m.cell >= 0) accept(m)
      })
      ch.on('broadcast', { event: 'skip' }, ({ payload }) => {
        const cfg = configRef.current
        const hostKey = playersRef.current.find((p) => p.role === 'host')?.key
        if (!cfg || !payload || payload.from !== hostKey || payload.n !== logRef.current.length) return
        accept({ seat: replay(cfg, logRef.current).seat, cell: -1, id: null })
      })
      // somebody who (re)joins asks for the round that is running; everybody who knows it answers (the answer is harmless to repeat)
      ch.on('broadcast', { event: 'sync' }, () => {
        const cfg = configRef.current
        if (cfg) setTimeout(() => send('log', { ...wire(cfg), moves: logRef.current }), Math.random() * 250)
      })
      ch.on('broadcast', { event: 'log' }, ({ payload }) => {
        const cfg = parseConfig(payload)
        if (!cfg) return
        const known = Array.isArray(payload.moves) ? payload.moves.filter(validMove).map((m) => ({ seat: m.seat, cell: m.cell, id: m.id ?? null })) : []
        if (!configRef.current) { begin(cfg, known); return }
        for (const m of known.slice(logRef.current.length)) if (!accept(m)) break
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

  const game = useMemo(() => (config ? replay(config, log) : null), [config, log])
  const over = game ? isOver(game) : false
  const myTurn = Boolean(config && game && !over && config.seats[game.seat] === myKey)
  const names = config ? config.seats.map((k, i) => (k === myKey ? 'You' : config.names[i])) : []

  // the host skips the turn of a player who has left (everybody else follows the 'skip')
  useEffect(() => {
    if (!host || !config || !game || over) return
    const key = config.seats[game.seat]
    if (key !== myKey && gone.includes(key)) {
      const n = logRef.current.length
      if (accept({ seat: game.seat, cell: -1, id: null })) send('skip', { from: myKey, n })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gone, log.length])

  function guess(p) {
    const n = logRef.current.length
    const move = { seat: game.seat, cell: open, id: p.id }
    const before = game
    if (accept(move)) {
      send('move', { from: myKey, n, seat: move.seat, cell: move.cell, id: move.id })
      const fit = applyMove(before, config.grid, move)?.last.hit
      setNote(fit ? '' : `${p.name} does not fit - you lose a life.`)
    }
    setOpen(null)
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

  const link = typeof window !== 'undefined' ? `${window.location.origin}/game/football-bingo?join=${code}` : ''
  async function share() {
    try {
      if (navigator.share) { await navigator.share({ title: 'Football Bingo', text: 'Join my Football Bingo room!', url: link }); return }
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* cancelled */ }
  }

  if (!supabase) return <Notice title="Online play is not available" text="This needs the online service." onLeave={onLeave} />
  if (phase === 'notfound') return <Notice title="Room not found" text="The code may be wrong, or the room is closed." onLeave={onLeave} />
  if (phase === 'full') return <Notice title="This room is full" text={`A room has room for ${MAX_PLAYERS} players.`} onLeave={onLeave} />
  if (phase === 'busy') return <Notice title="The round has already started" text="Ask the host for the next round." onLeave={onLeave} />
  if (phase === 'outdated') return <Notice title="Please reload the page" text="This round was made with a newer version of the game." onLeave={onLeave} />

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
          <button onClick={hostStart} disabled={players.length < 2} className="w-full rounded-2xl bg-orange-glow py-4 font-display text-xl font-bold text-ink-950 active:scale-[0.99] disabled:opacity-40">
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
  if (!config || !game) return null
  return (
    <>
      <div className="mx-auto max-w-md pb-24">
        <TurnBar state={game} names={names} />
        <BingoBoard grid={config.grid} state={game} names={names} onCell={myTurn ? (i) => { setOpen(i); setNote('') } : null} lastCell={game.last?.hit ? game.last.cell : -1} />
        {note && <p className="mt-3 text-center text-sm text-red-300">{note}</p>}
        {!over && <p className="mt-3 text-center text-xs text-white/40">{myTurn ? 'Your turn: tap a field and name a footballer who fits both categories.' : `Waiting for ${names[game.seat]} ...`}</p>}
        {over && (
          <div className="mt-6 text-center">
            <Verdict state={game} names={names} />
            <div className="space-y-2">
              {host ? (
                <>
                  <button onClick={hostStart} className="w-full rounded-2xl bg-orange-glow py-4 font-display text-xl font-bold text-ink-950 active:scale-[0.99]">New random grid</button>
                  {mode === 'room' && <button onClick={backToLobby} className="w-full rounded-2xl bg-white/10 py-3.5 font-semibold text-white active:scale-[0.99]">Back to the room</button>}
                </>
              ) : (
                <p className="text-sm text-white/55"><Dots /> The host starts the next round</p>
              )}
            </div>
          </div>
        )}
        <div className="mt-4 text-center"><button onClick={onLeave} className="text-sm text-white/40 transition hover:text-white/70">Leave</button></div>
        {open != null && <GuessSheet grid={config.grid} cell={open} used={game.used} onGuess={guess} onClose={() => setOpen(null)} />}
      </div>
      {dock}
    </>
  )
}
