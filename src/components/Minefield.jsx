import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Confetti from './Confetti'
import ShareResult from './ShareResult'
import DayPicker from './DayPicker'
import { useAuth } from '../lib/AuthContext'
import {
  getTodayMinefield,
  getMinefieldForDate,
  getMinefieldAvailableDates,
  getMyRankedMinefieldAttempt,
  submitMinefieldAttempt,
  pointsForBombs,
} from '../lib/minefieldChallenge'

function shuffledTiles(challenge) {
  const tiles = challenge.tiles.map((t, i) => ({ ...t, tileId: i }))
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return tiles
}

export default function Minefield({ mode }) {
  const { date: dateParam } = useParams()
  const { user } = useAuth()
  return <MinefieldRunner mode={mode} date={mode === 'date' ? dateParam : null} isSignedIn={!!user} />
}

function MinefieldRunner({ mode, date, isSignedIn }) {
  const [challenge, setChallenge] = useState(undefined) // undefined = loading, null = not found
  const [availableDates, setAvailableDates] = useState([])
  const [alreadyPlayed, setAlreadyPlayed] = useState(null)
  const [tiles, setTiles] = useState([])
  const [revealed, setRevealed] = useState({})
  const [justHitTileId, setJustHitTileId] = useState(null)
  const [bombsHit, setBombsHit] = useState(0)
  const [shake, setShake] = useState(false)
  const [status, setStatus] = useState('playing') // playing | won | lost
  const [submitted, setSubmitted] = useState(false)

  const isRankedRun = mode === 'today'

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [data, dates] = await Promise.all([
        mode === 'today' ? getTodayMinefield() : getMinefieldForDate(date),
        getMinefieldAvailableDates(),
      ])
      if (cancelled) return
      setChallenge(data ?? null)
      setAvailableDates(dates)
      if (data) {
        setTiles(shuffledTiles(data))
      }

      if (mode === 'today' && isSignedIn && data) {
        const attempt = await getMyRankedMinefieldAttempt(data.date)
        if (!cancelled) setAlreadyPlayed(attempt)
      }
    }
    load().catch(() => !cancelled && setChallenge(null))
    return () => {
      cancelled = true
    }
  }, [mode, date, isSignedIn])

  function resetRound(data) {
    setTiles(shuffledTiles(data))
    setRevealed({})
    setJustHitTileId(null)
    setBombsHit(0)
    setShake(false)
    setStatus('playing')
    setSubmitted(false)
  }

  const safeRevealedCount = tiles.filter((t) => t.meets_criteria && revealed[t.tileId]).length

  async function finish(nextStatus, finalBombs) {
    setStatus(nextStatus)
    if (!submitted) {
      setSubmitted(true)
      try {
        await submitMinefieldAttempt({
          challengeDate: challenge.date,
          bombsHit: finalBombs,
          safeFound: nextStatus === 'won' ? 10 : safeRevealedCount,
          completed: nextStatus === 'won',
        })
      } catch {
        // best-effort — the round result is still shown locally either way
      }
    }
  }

  function clickTile(tile) {
    if (status !== 'playing' || bombsHit >= 6 || revealed[tile.tileId]) return

    setRevealed((r) => ({ ...r, [tile.tileId]: true }))

    if (tile.meets_criteria) {
      const nextSafeCount = safeRevealedCount + 1
      if (nextSafeCount >= 10) finish('won', bombsHit)
    } else {
      setJustHitTileId(tile.tileId)
      const nextBombs = bombsHit + 1
      setBombsHit(nextBombs)
      setShake(true)
      setTimeout(() => setShake(false), 550)
      if (nextBombs >= 6) {
        setTimeout(() => {
          setRevealed(Object.fromEntries(tiles.map((t) => [t.tileId, true])))
          finish('lost', nextBombs)
        }, 500)
      }
    }
  }

  if (challenge === undefined) return <p className="text-white/60">Loading…</p>

  if (challenge === null) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <DayPicker basePath="/game/minefield" activeDate={date} availableDates={availableDates} />
        <p className="text-white/60">
          {mode === 'today'
            ? "Today's Minefield needs a connected Supabase project with seeded content."
            : 'No Minefield category found for that date.'}
        </p>
      </div>
    )
  }

  if (mode === 'today' && alreadyPlayed) {
    return (
      <div className="mx-auto max-w-xl">
        <DayPicker basePath="/game/minefield" activeDate={date} availableDates={availableDates} />
        <div className="text-center glass-card rounded-2xl p-8">
          <p className="text-xs uppercase tracking-wide text-orange-glow font-semibold">Today · ranked</p>
          <h2 className="font-display text-2xl font-bold text-white mt-2">{challenge.title}</h2>
          <p className="mt-3 text-white/70">
            You've already played today's ranked Minefield — {alreadyPlayed.safe_found}/10 safe found,{' '}
            {alreadyPlayed.bombs_hit} bombs hit.
          </p>
          <p className="mt-1 text-sm text-white/50">Come back tomorrow for a new category, or pick a past day above to practice.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <DayPicker basePath="/game/minefield" activeDate={date} availableDates={availableDates} />

      <motion.div animate={shake ? { x: [0, -12, 11, -9, 8, -5, 4, 0] } : { x: 0 }} transition={{ duration: 0.55, ease: 'easeInOut' }}>
        {status === 'won' && <Confetti />}

        <div className="mb-4 text-center">
          <p className="text-xs uppercase tracking-wide text-orange-glow font-semibold">
            {isRankedRun ? 'Today · ranked' : 'Practice · unranked'}
          </p>
          <h2 className="font-display text-2xl font-bold text-white mt-1">{challenge.title}</h2>
          <div className="mt-2 flex justify-center gap-1.5" aria-label={`${bombsHit} of 6 bombs triggered`}>
            {Array.from({ length: 6 }, (_, i) => (
              <motion.span
                key={i}
                animate={i < bombsHit ? { scale: [1, 1.4, 1] } : {}}
                transition={{ duration: 0.4 }}
                className={`text-lg ${i < bombsHit ? 'grayscale-0' : 'opacity-25 grayscale'}`}
              >
                💣
              </motion.span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ perspective: 1000 }}>
          {tiles.map((tile) => (
            <MinefieldTile
              key={tile.tileId}
              tile={tile}
              isRevealed={!!revealed[tile.tileId]}
              justHit={tile.tileId === justHitTileId}
              disabled={status !== 'playing'}
              onClick={() => clickTile(tile)}
            />
          ))}
        </div>

        {status !== 'playing' && (
          <div className="mt-6 text-center">
            <h3 className="font-display text-2xl font-bold text-white">
              {status === 'won' ? 'You cleared the minefield!' : 'Boom — you hit all 6 mines.'}
            </h3>
            {isRankedRun && status === 'won' && (
              <p className="mt-1 text-amber-glow font-semibold">+{pointsForBombs(bombsHit)} points</p>
            )}
            <div className="mt-4 flex justify-center gap-3">
              {!isRankedRun && (
                <button
                  onClick={() => resetRound(challenge)}
                  className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition"
                >
                  Play Again
                </button>
              )}
              <ShareResult
                gameName="Minefield"
                lines={[
                  challenge.title,
                  status === 'won' ? `Cleared with ${bombsHit}/6 bombs hit` : `Hit all 6 bombs (${safeRevealedCount}/10 safe found)`,
                ]}
              />
            </div>
            {!isRankedRun && (
              <Link to="/game/minefield" className="mt-4 inline-block text-orange-glow underline underline-offset-2 text-sm">
                Play today's ranked Minefield →
              </Link>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}

function MinefieldTile({ tile, isRevealed, justHit, disabled, onClick }) {
  const faceClass =
    'absolute inset-0 flex h-full w-full flex-col items-center justify-center rounded-xl border p-2 text-center text-xs font-semibold [backface-visibility:hidden]'

  return (
    <div className="relative h-24">
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        animate={{ rotateY: isRevealed ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <button
          onClick={onClick}
          disabled={disabled || isRevealed}
          className={`${faceClass} border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:border-orange-glow/40 transition-colors disabled:hover:bg-white/[0.04]`}
        >
          <span className="leading-tight">{tile.name}</span>
        </button>

        <div
          className={`${faceClass} ${
            tile.meets_criteria ? 'border-orange-glow bg-orange-glow/15 text-orange-glow' : 'border-red-500 bg-red-500/15 text-red-400'
          }`}
          style={{ transform: 'rotateY(180deg)' }}
        >
          {isRevealed && (
            <>
              <motion.span
                initial={{ scale: 0, rotate: tile.meets_criteria ? -15 : 0, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.35, ease: 'backOut' }}
                className="text-lg"
              >
                {tile.meets_criteria ? '✅' : '💥'}
              </motion.span>
              <span className="mt-1 leading-tight">{tile.name}</span>
              <span className="mt-0.5 text-[10px] font-normal opacity-80">{tile.actual_value}</span>
            </>
          )}
        </div>
      </motion.div>

      {justHit && isRevealed && <BombBurst />}
    </div>
  )
}

function BombBurst() {
  const [particles] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      angle: (i / 12) * 360 + Math.random() * 15,
      distance: 26 + Math.random() * 22,
      delay: Math.random() * 0.05,
      size: 3 + Math.random() * 4,
      color: i % 2 === 0 ? '#ef4444' : '#fb7a24',
    })),
  )

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-visible">
      <motion.span
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.6, 1.1], opacity: [0, 1, 0] }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="absolute text-3xl"
      >
        💥
      </motion.span>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
            y: Math.sin((p.angle * Math.PI) / 180) * p.distance,
            opacity: 0,
            scale: 0,
          }}
          transition={{ duration: 0.55, delay: p.delay, ease: 'easeOut' }}
          className="absolute rounded-full"
          style={{ width: p.size, height: p.size, backgroundColor: p.color }}
        />
      ))}
    </div>
  )
}
