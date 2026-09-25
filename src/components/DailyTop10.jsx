import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, HeartBreak } from '@phosphor-icons/react'
import Confetti from './Confetti'
import ShareResult from './ShareResult'
import DayPicker from './DayPicker'
import { useAuth } from '../lib/AuthContext'
import {
  getTodayChallenge,
  getChallengeForDate,
  getDailyAvailableDates,
  getMyRankedAttempt,
  submitDailyAttempt,
} from '../lib/dailyChallenge'
import players from '../data/players.json'

const START_LIVES = 3
const SCAN_STEP_MS = 130
const knownNames = [...new Set(players.map((p) => p.name))]

function normalize(s) {
  return s.trim().toLowerCase()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Each day's round is persisted so switching days and coming back restores
// progress instead of resetting it — otherwise navigating away and back (or
// closing the tab) would be a free retry on today's ranked run. localStorage
// (not sessionStorage) specifically so a closed tab doesn't reset it either.
function roundKey(date) {
  return `topbin:daily-top10:${date}`
}

function loadRound(date) {
  try {
    const raw = localStorage.getItem(roundKey(date))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveRound(date, round) {
  try {
    localStorage.setItem(roundKey(date), JSON.stringify(round))
  } catch {
    // ignore storage errors (private mode, quota, etc.) — worst case the round doesn't persist
  }
}

export default function DailyTop10({ mode }) {
  const { date: dateParam } = useParams()
  const { user } = useAuth()
  return <ChallengeRunner mode={mode} date={mode === 'date' ? dateParam : null} isSignedIn={!!user} />
}

function ChallengeRunner({ mode, date, isSignedIn }) {
  const [challenge, setChallenge] = useState(undefined) // undefined = loading, null = not found
  const [availableDates, setAvailableDates] = useState([])
  const [alreadyPlayed, setAlreadyPlayed] = useState(null)
  const [input, setInput] = useState('')
  const [found, setFound] = useState({}) // rank -> name
  const [lives, setLives] = useState(START_LIVES)
  const [shakeInput, setShakeInput] = useState(false)
  const [status, setStatus] = useState('playing') // playing | won | lost
  const [submitted, setSubmitted] = useState(false)
  const [scanningRank, setScanningRank] = useState(null)
  const roundIdRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    roundIdRef.current += 1
    setChallenge(undefined)
    setAlreadyPlayed(null)
    async function load() {
      const [data, dates] = await Promise.all([
        mode === 'today' ? getTodayChallenge() : getChallengeForDate(date),
        getDailyAvailableDates(),
      ])
      if (cancelled) return
      setChallenge(data ?? null)
      setAvailableDates(dates)

      if (data) {
        const saved = loadRound(data.date)
        setInput('')
        setShakeInput(false)
        setScanningRank(null)
        if (saved) {
          setFound(saved.found)
          setLives(saved.lives)
          setStatus(saved.status)
          setSubmitted(saved.submitted)
        } else {
          setFound({})
          setLives(START_LIVES)
          setStatus('playing')
          setSubmitted(false)
        }
      }

      if (mode === 'today' && isSignedIn && data) {
        const attempt = await getMyRankedAttempt(data.date)
        if (!cancelled) setAlreadyPlayed(attempt)
      }
    }
    load().catch(() => !cancelled && setChallenge(null))
    return () => {
      cancelled = true
    }
  }, [mode, date, isSignedIn])

  useEffect(() => {
    if (challenge) {
      saveRound(challenge.date, { found, lives, status, submitted })
    }
  }, [challenge, found, lives, status, submitted])

  const suggestions = useMemo(() => {
    if (!input.trim() || !challenge) return []
    const pool = new Set([...knownNames, ...challenge.entries.map((e) => e.name)])
    const q = normalize(input)
    return [...pool].filter((n) => normalize(n).includes(q)).slice(0, 6)
  }, [input, challenge])

  function resetRound() {
    setInput('')
    setFound({})
    setLives(START_LIVES)
    setShakeInput(false)
    setStatus('playing')
    setSubmitted(false)
    setScanningRank(null)
  }

  const isRankedRun = mode === 'today'

  async function finish(nextStatus, foundMap, livesLeft) {
    setStatus(nextStatus)
    if (!submitted) {
      setSubmitted(true)
      try {
        await submitDailyAttempt({
          challengeDate: challenge.date,
          livesRemaining: livesLeft,
          foundCount: Object.keys(foundMap).length,
          completed: nextStatus === 'won',
        })
      } catch (err) {
        // best-effort — the round result is still shown locally either way,
        // but log it: a silently-swallowed insert failure here (e.g. a
        // missing profiles row) means this result never reaches the
        // leaderboard/dashboard with no visible sign anything went wrong.
        console.error('submitDailyAttempt failed:', err)
      }
    }
  }

  async function submitGuess(name) {
    if (status !== 'playing' || scanningRank !== null || !name.trim()) return
    const roundId = roundIdRef.current
    const guess = normalize(name)
    const match = challenge.entries.find((e) => normalize(e.name) === guess)
    const alreadyFound = match && found[match.rank]

    setInput('')

    if (alreadyFound) {
      // Already-revealed name typed again — no suspense needed, just a nudge.
      const nextLives = lives - 1
      setLives(nextLives)
      setShakeInput(true)
      setTimeout(() => setShakeInput(false), 400)
      if (nextLives <= 0) finish('lost', found, 0)
      return
    }

    // Countdown from rank 10 down to either the guess's actual rank (correct
    // guess) or rank 1 (not in the list at all) before revealing the result.
    const targetRank = match ? match.rank : 1
    for (let rank = 10; rank >= targetRank; rank--) {
      setScanningRank(rank)
      await sleep(SCAN_STEP_MS)
      // Bail if the player switched to a different day mid-scan — otherwise
      // this guess would land on whatever day they navigated to instead.
      if (roundIdRef.current !== roundId) return
    }
    setScanningRank(null)

    if (match) {
      const nextFound = { ...found, [match.rank]: match.name }
      setFound(nextFound)
      if (Object.keys(nextFound).length >= 10) finish('won', nextFound, lives)
    } else {
      const nextLives = lives - 1
      setLives(nextLives)
      setShakeInput(true)
      setTimeout(() => setShakeInput(false), 400)
      if (nextLives <= 0) finish('lost', found, 0)
    }
  }

  if (challenge === undefined) return <p className="text-white/60">Loading…</p>

  if (challenge === null) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <DayPicker basePath="/game/daily-top10" activeDate={date} availableDates={availableDates} />
        <p className="text-white/60">
          {mode === 'today'
            ? "Today's challenge needs a connected Supabase project with seeded content."
            : 'No challenge found for that date.'}
        </p>
      </div>
    )
  }

  if (mode === 'today' && alreadyPlayed) {
    return (
      <div className="mx-auto max-w-xl">
        <DayPicker basePath="/game/daily-top10" activeDate={date} availableDates={availableDates} />
        <div className="text-center glass-card rounded-2xl p-8">
          <p className="text-xs uppercase tracking-wide text-orange-glow font-semibold">Today · ranked</p>
          <h2 className="font-display text-2xl font-bold text-white mt-2">{challenge.title}</h2>
          <p className="mt-3 text-white/70">
            You've already played today's ranked challenge — {alreadyPlayed.found_count}/10 found,{' '}
            {alreadyPlayed.lives_remaining} lives left.
          </p>
          <p className="mt-1 text-sm text-white/50">Come back tomorrow for a new category, or pick a past day above to practice.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <DayPicker basePath="/game/daily-top10" activeDate={date} availableDates={availableDates} />

      {status === 'won' && <Confetti />}

      <div className="mb-4 text-center">
        <p className="text-xs uppercase tracking-wide font-semibold text-orange-glow">
          {isRankedRun ? 'Today · ranked' : 'Practice · unranked'}
        </p>
        <h2 className="font-display text-2xl font-bold text-white mt-1">{challenge.title}</h2>
        {challenge.sort_hint && <p className="mt-1 text-xs italic text-white/40">{challenge.sort_hint}</p>}
        <div className="mt-2 flex justify-center gap-1" aria-label={`${lives} lives remaining`}>
          {Array.from({ length: START_LIVES }, (_, i) =>
            i < lives ? (
              <Heart key={i} weight="fill" size={22} className="text-red-500" />
            ) : (
              <HeartBreak key={i} weight="fill" size={22} className="text-white/25" />
            ),
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((rank) => {
          const isFound = !!found[rank]
          const isScanningHere = scanningRank === rank
          return (
            <motion.div
              key={rank}
              animate={
                isFound
                  ? { scale: [0.85, 1.08, 1] }
                  : isScanningHere
                    ? { scale: [1, 1.1, 1] }
                    : { scale: 1 }
              }
              transition={{ duration: isFound ? 0.45 : SCAN_STEP_MS / 1000, ease: 'easeOut' }}
              className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-2 transition-colors duration-150 ${
                isFound
                  ? 'border-orange-glow bg-orange-glow/15 text-white'
                  : isScanningHere
                    ? 'border-amber-glow bg-amber-glow/15 text-white shadow-[0_0_18px_rgba(245,185,66,0.45)]'
                    : 'border-white/10 bg-white/[0.03] text-white/30'
              }`}
            >
              <span className="font-display font-bold w-5 text-right">{rank}</span>
              <span className="truncate">{found[rank] ?? (status !== 'playing' ? challenge.entries[rank - 1]?.name : '???')}</span>
            </motion.div>
          )
        })}
      </div>

      {status === 'playing' ? (
        <div className={`relative ${shakeInput ? 'animate-[shake_0.4s]' : ''}`}>
          <style>{`
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              20%, 60% { transform: translateX(-8px); }
              40%, 80% { transform: translateX(8px); }
            }
          `}</style>
          <input
            autoFocus
            disabled={scanningRank !== null}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitGuess(input)}
            placeholder={scanningRank !== null ? 'Checking…' : 'Type a name…'}
            className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-orange-glow disabled:opacity-60"
          />
          {suggestions.length > 0 && (
            <ul className="glass-card absolute z-10 mt-1 w-full rounded-xl overflow-hidden">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    onClick={() => submitGuess(s)}
                    className="block w-full px-4 py-2 text-left text-sm text-white/80 hover:bg-white/10"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="text-center">
          <h3 className="font-display text-2xl font-bold text-white">
            {status === 'won' ? 'You found all 10!' : `You found ${Object.keys(found).length} of 10`}
          </h3>
          {isRankedRun && status === 'won' && (
            <p className="mt-1 text-amber-glow font-semibold">
              +{lives === 3 ? 100 : lives === 2 ? 70 : 40} points
            </p>
          )}
          <div className="mt-4 flex justify-center gap-3">
            {!isRankedRun && (
              <button
                onClick={resetRound}
                className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition"
              >
                Play Again
              </button>
            )}
            <ShareResult
              gameName="Daily Top 10"
              lines={[
                challenge.title,
                status === 'won' ? `Found 10/10 with ${lives} ❤️ left` : `Found ${Object.keys(found).length}/10`,
              ]}
            />
          </div>
          {!isRankedRun && (
            <Link to="/game/daily-top10" className="mt-4 inline-block text-orange-glow underline underline-offset-2 text-sm">
              Play today's ranked challenge →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
