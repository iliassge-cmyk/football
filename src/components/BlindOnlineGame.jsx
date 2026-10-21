import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Crown, ShareNetwork } from '@phosphor-icons/react'
import { Play, Rankings, Setup } from './BlindParts'
import { ChatDock, RoomChat } from './RoomChat'
import { supabase } from '../lib/supabaseClient'
import { cleanName, tabId } from '../lib/bwIdentity'
import { containsProfanity } from '../lib/profanity'
import { DEFAULT_FILTERS, PLAYER_COLORS, SUGGESTIONS, buildPool, drawSequence, sequenceFromIds, validBoard } from '../lib/blindRanking'

const MAX_PLAYERS = 4
const GRACE_MS = 9000 // how long a player may be away before the others stop waiting for the ranking
const WAIT_FOR_OPPONENT_MS = 14000
const QUICK_LENGTH = 5

/** What arrives from another device is checked before it is used. */
function parseConfig(p) {
  if (!p || !Array.isArray(p.ids) || !Array.isArray(p.seats) || !Array.isArray(p.names)) return null
  const ids = p.ids.map(String)
  if (![5, 10].includes(ids.length) || new Set(ids).size !== ids.length) return null
  const seats = p.seats.filter((k) => typeof k === 'string').slice(0, MAX_PLAYERS)
  if (!seats.length) return null
  const topic = String(p.category ?? '').slice(0, 60).trim()
  return { category: !topic || containsProfanity(topic) ? 'Surprise topic' : topic, length: ids.length, ids, seats, names: seats.map((_, i) => cleanName(p.names[i], `Player ${i + 1}`)) }
}

/**
 * An online Blind Ranking, everybody on their own device.
 *   mode 'room'   friends: the host creates a room (and chooses topic, length and footballers), the others join with the code or a link; the room has a chat
 *   mode 'quick'  two strangers, starts by itself with a random topic
 * Everybody ranks the same footballers in the same order, at their own pace. A finished ranking is sent to the others; when everybody is done
 * (or has left), all rankings are shown side by side. There is no referee: only the start of a round comes from the host.
 */
export default function BlindOnlineGame({ code, role, playerName, mode = 'room', onLeave, onLost }) {
  const host = role === 'host'
  const myKey = useMemo(() => tabId(), [])
  const [phase, setPhase] = useState('connecting') // connecting | lobby | playing | notfound | full | busy | outdated
  const [players, setPlayers] = useState([])
  const [config, setConfig] = useState(null)
  const [boards, setBoards] = useState({})
  const [progress, setProgress] = useState({}) // how many footballers each player has placed
  const [gone, setGone] = useState([])
  const [copied, setCopied] = useState(false)
  const [messages, setMessages] = useState([])

  const chRef = useRef(null)
  const playersRef = useRef([])
  const configRef = useRef(null)
  const boardsRef = useRef({})
  const progressRef = useRef({})
  const lastSetup = useRef(null) // host: topic, length and footballers of the last round, for "Play again"
  const hostSeen = useRef(false)
  const lastChat = useRef(0)

  const mergeProgress = useCallback((p) => {
    const cfg = configRef.current
    if (!cfg || !p || typeof p !== 'object') return
    const next = { ...progressRef.current }
    for (const [k, n] of Object.entries(p)) if (k !== myKey && cfg.seats.includes(k) && Number.isInteger(n) && n >= 0 && n <= cfg.length) next[k] = Math.max(next[k] ?? 0, n)
    progressRef.current = next
    setProgress(next)
  }, [myKey])
  const send = useCallback((event, payload = {}) => chRef.current?.send({ type: 'broadcast', event, payload }), [])

  const begin = useCallback((cfg, known = {}) => {
    if (!sequenceFromIds(cfg.ids)) { setPhase('outdated'); return }
    configRef.current = cfg
    boardsRef.current = Object.fromEntries(Object.entries(known).filter(([k, b]) => cfg.seats.includes(k) && validBoard(b, cfg.ids)))
    progressRef.current = Object.fromEntries(Object.keys(boardsRef.current).map((k) => [k, cfg.length]))
    setConfig(cfg)
    setBoards(boardsRef.current)
    setProgress(progressRef.current)
    setGone([])
    setPhase(cfg.seats.includes(myKey) ? 'playing' : 'busy')
  }, [myKey])

  const hostStart = useCallback((setup) => {
    lastSetup.current = setup
    const here = playersRef.current.slice(0, MAX_PLAYERS)
    const cfg = {
      category: setup.category,
      length: setup.length,
      ids: drawSequence(setup.pool, setup.length).map((p) => p.id),
      seats: here.map((p) => p.key),
      names: here.map((p, i) => cleanName(p.name, i === 0 ? 'Host' : `Guest ${i}`)),
    }
    begin(cfg)
    send('start', cfg)
  }, [begin, send])

  function backToLobby() {
    configRef.current = null
    boardsRef.current = {}
    progressRef.current = {}
    setConfig(null)
    setBoards({})
    setProgress({})
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
      ch = supabase.channel(`br:${code}`, { config: { broadcast: { self: false }, presence: { key: myKey } } })
      chRef.current = ch

      ch.on('broadcast', { event: 'start' }, ({ payload }) => {
        const cfg = parseConfig(payload)
        if (cfg && !host) begin(cfg)
      })
      ch.on('broadcast', { event: 'lobby' }, () => {
        if (host) return
        configRef.current = null
        boardsRef.current = {}
        progressRef.current = {}
        setConfig(null)
        setBoards({})
        setProgress({})
        setGone([])
        setPhase('lobby')
      })
      ch.on('broadcast', { event: 'board' }, ({ payload }) => {
        const cfg = configRef.current
        if (!cfg || !cfg.seats.includes(payload.from) || !validBoard(payload.board, cfg.ids)) return
        boardsRef.current = { ...boardsRef.current, [payload.from]: payload.board }
        progressRef.current = { ...progressRef.current, [payload.from]: cfg.length }
        setBoards(boardsRef.current)
        setProgress(progressRef.current)
      })
      ch.on('broadcast', { event: 'step' }, ({ payload }) => {
        const cfg = configRef.current
        const n = Number(payload.n)
        if (!cfg || !cfg.seats.includes(payload.from) || !Number.isInteger(n) || n < 0 || n > cfg.length) return
        progressRef.current = { ...progressRef.current, [payload.from]: Math.max(progressRef.current[payload.from] ?? 0, n) }
        setProgress(progressRef.current)
      })
      // somebody who (re)joins asks for the round that is running; everybody who knows it answers (the answer is harmless to repeat)
      ch.on('broadcast', { event: 'sync' }, () => {
        const cfg = configRef.current
        if (cfg) setTimeout(() => send('log', { ...cfg, boards: boardsRef.current, progress: progressRef.current }), Math.random() * 250)
      })
      ch.on('broadcast', { event: 'log' }, ({ payload }) => {
        if (configRef.current) {
          // already in the round: only take over rankings of the others that were missed
          const cfg = configRef.current
          const add = Object.entries(payload.boards ?? {}).filter(([k, b]) => k !== myKey && !boardsRef.current[k] && cfg.seats.includes(k) && validBoard(b, cfg.ids))
          if (add.length) { boardsRef.current = { ...boardsRef.current, ...Object.fromEntries(add) }; setBoards(boardsRef.current) }
          mergeProgress(payload.progress)
          return
        }
        const cfg = parseConfig(payload)
        if (cfg) { begin(cfg, payload.boards ?? {}); mergeProgress(payload.progress) }
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
          if (host && mode === 'quick' && list.length >= 2) hostStart({ category: SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)], length: QUICK_LENGTH, pool: buildPool(DEFAULT_FILTERS) })
          return
        }
        // a round is running: whoever stays away for a while is no longer waited for (unless the ranking is already in)
        cfg.seats.forEach((key) => {
          if (present.has(key)) { clearTimeout(leaveTimers.get(key)); leaveTimers.delete(key); setGone((g) => g.filter((k) => k !== key)); return }
          if (leaveTimers.has(key) || key === myKey) return
          leaveTimers.set(key, setTimeout(() => { leaveTimers.delete(key); if (!closed) setGone((g) => (g.includes(key) ? g : [...g, key])) }, GRACE_MS))
        })
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
      for (const t of leaveTimers.values()) clearTimeout(t)
      chRef.current = null
      if (ch) supabase.removeChannel(ch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, role])

  const sequence = useMemo(() => (config ? sequenceFromIds(config.ids) : null), [config])
  const mySeat = config ? config.seats.indexOf(myKey) : -1
  const mine = boards[myKey]
  // who the round still waits for
  const waitingFor = config ? config.seats.filter((k) => !boards[k] && !gone.includes(k)) : []
  const finished = Boolean(config && mine && waitingFor.length === 0)
  // the others who are still in the round: the next footballer waits until they have placed the current one too
  const peers = config ? config.seats.map((k, i) => ({ key: k, name: config.names[i], placed: progress[k] ?? 0 })).filter((p) => p.key !== myKey && !gone.includes(p.key)) : []

  function onPlaced(n) {
    progressRef.current = { ...progressRef.current, [myKey]: n }
    send('step', { from: myKey, n })
  }
  function onFinish(board) {
    boardsRef.current = { ...boardsRef.current, [myKey]: board }
    setBoards(boardsRef.current)
    send('board', { from: myKey, board })
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

  const link = typeof window !== 'undefined' ? `${window.location.origin}/game/blind-ranking?join=${code}` : ''
  async function share() {
    try {
      if (navigator.share) { await navigator.share({ title: 'Blind Ranking', text: 'Join my Blind Ranking room!', url: link }); return }
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
          <div className="text-left">
            <Setup
              variant="room"
              onStart={hostStart}
              startLabel={players.length < 2 ? 'Waiting for players …' : `Start with ${Math.min(players.length, MAX_PLAYERS)} players`}
              startDisabled={players.length < 2}
            />
          </div>
        ) : (
          <p className="text-sm text-white/55"><Dots /> {phase === 'connecting' ? 'Joining the room' : 'Waiting for the host to start'}</p>
        )}

        <div className="mt-6"><RoomChat messages={messages} onSend={sendChat} myKey={myKey} height="h-36" /></div>
        <button onClick={onLeave} className="mt-6 text-sm text-white/40 transition hover:text-white/70">Leave room</button>
      </div>
    )
  }

  // ---- the round --------------------------------------------------------------------------------------------------------------------
  if (!config || !sequence) return null
  if (!mine) {
    return (
      <>
        <Play
          key={config.ids.join()}
          category={config.category}
          name="You"
          color={PLAYER_COLORS[mySeat]}
          count={1}
          sequence={sequence}
          length={config.length}
          peers={peers}
          onPlaced={onPlaced}
          onFinish={onFinish}
          onQuit={onLeave}
        />
        {dock}
      </>
    )
  }
  if (!finished) {
    return (
      <div className="mx-auto max-w-sm pt-10 text-center">
        <h2 className="font-display text-2xl font-bold text-white">Your ranking is in.</h2>
        <p className="mb-6 mt-1 text-white/55"><Dots /> Waiting for the others</p>
        <ul className="space-y-1.5 text-left">
          {config.seats.map((k, i) => (
            <li key={k} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PLAYER_COLORS[i] }} />
                <span className="truncate">{k === myKey ? 'You' : config.names[i]}</span>
              </span>
              {boards[k] ? <Check weight="bold" className="text-green-400" size={16} /> : gone.includes(k) ? <span className="text-xs text-white/40">left</span> : <span className="text-xs text-white/40">ranking …</span>}
            </li>
          ))}
        </ul>
        <button onClick={onLeave} className="mt-8 text-sm text-white/40 transition hover:text-white/70">Leave</button>
        {dock}
      </div>
    )
  }
  const done = config.seats.map((k, i) => ({ key: k, name: config.names[i] })).filter((s) => boards[s.key])
  return (
    <>
      <Rankings category={config.category} names={done.map((s) => s.name)} boards={done.map((s) => boards[s.key])} sequence={sequence} myIndex={done.findIndex((s) => s.key === myKey)}>
        <div className="mt-7 space-y-2">
          {host ? (
            <>
              <button
                onClick={() => hostStart(lastSetup.current ?? { category: config.category, length: config.length, pool: buildPool(DEFAULT_FILTERS) })}
                className="w-full rounded-2xl bg-orange-glow py-4 font-display text-xl font-bold text-ink-950 active:scale-[0.99]"
              >
                Play again
              </button>
              {mode === 'room' && (
                <button onClick={backToLobby} className="w-full rounded-2xl bg-white/10 py-3.5 font-semibold text-white active:scale-[0.99]">New topic</button>
              )}
            </>
          ) : (
            <p className="text-center text-sm text-white/55"><Dots /> The host starts the next round</p>
          )}
          <button onClick={onLeave} className="w-full py-2 text-sm text-white/40 hover:text-white/70">Leave</button>
        </div>
      </Rankings>
      {dock}
    </>
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
      <h2 className="mb-2 font-display text-2xl font-bold text-white">{title}</h2>
      <p className="mb-6 text-sm text-white/55">{text}</p>
      <button onClick={onLeave} className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20">Back</button>
    </div>
  )
}
