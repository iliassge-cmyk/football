import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Confetti from './Confetti'
import ShareResult from './ShareResult'
import { useAuth } from '../lib/AuthContext'
import { isBackendConfigured } from '../lib/supabaseClient'
import {
  getTodayChallenge,
  getChallengeForDate,
  getArchiveList,
  getMyRankedAttempt,
  submitDailyAttempt,
} from '../lib/dailyChallenge'
import players from '../data/players.json'

const START_LIVES = 3
const knownNames = [...new Set(players.map((p) => p.name))]

function normalize(s) {
  return s.trim().toLowerCase()
}

export default function DailyTop10({ mode }) {
  const { date: dateParam } = useParams()
  const { user } = useAuth()

  if (mode === 'archive') return <ArchiveList />

  return <ChallengeRunner mode={mode} date={mode === 'date' ? dateParam : null} isSignedIn={!!user} />
}

function ArchiveList() {
  const [days, setDays] = useState(null)

  useEffect(() => {
    getArchiveList()
      .then(setDays)
      .catch(() => setDays([]))
  }, [])

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="font-display text-2xl font-bold text-white mb-1">Daily Top 10 — Archive</h2>
      <p className="text-sm text-white/50 mb-4">
        Replay the last 15 days for practice. These attempts are always unranked.
      </p>
      {!isBackendConfigured ? (
        <p className="text-white/60 text-sm">Archive needs a connected Supabase project.</p>
      ) : days === null ? (
        <p className="text-white/60 text-sm">Loading…</p>
      ) : days.length === 0 ? (
        <p className="text-white/60 text-sm">No past challenges yet.</p>
      ) : (
        <ul className="space-y-2">
          {days.map((d) => (
            <li key={d.date}>
              <Link
                to={`/game/daily-top10/${d.date}`}
                className="glass-card flex items-center justify-between rounded-xl px-4 py-3 hover:border-emerald-glow/40 transition-colors"
              >
                <span className="text-sm text-white/60">{d.date}</span>
                <span className="font-medium text-white">{d.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ChallengeRunner({ mode, date, isSignedIn }) {
  const [challenge, setChallenge] = useState(undefined) // undefined = loading, null = not found
  const [alreadyPlayed, setAlreadyPlayed] = useState(null)
  const [input, setInput] = useState('')
  const [found, setFound] = useState({}) // rank -> name
  const [lives, setLives] = useState(START_LIVES)
  const [shakeInput, setShakeInput] = useState(false)
  const [status, setStatus] = useState('playing') // playing | won | lost
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const data = mode === 'today' ? await getTodayChallenge() : await getChallengeForDate(date)
      if (cancelled) return
      setChallenge(data ?? null)

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

  const suggestions = useMemo(() => {
    if (!input.trim() || !challenge) return []
    const pool = new Set([...knownNames, ...challenge.entries.map((e) => e.name)])
    const q = normalize(input)
    return [...pool].filter((n) => normalize(n).includes(q)).slice(0, 6)
  }, [input, challenge])

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
      } catch {
        // best-effort — the round result is still shown locally either way
      }
    }
  }

  function submitGuess(name) {
    if (status !== 'playing' || !name.trim()) return
    const guess = normalize(name)
    const match = challenge.entries.find((e) => normalize(e.name) === guess)
    const alreadyFound = match && found[match.rank]

    if (match && !alreadyFound) {
      const nextFound = { ...found, [match.rank]: match.name }
      setFound(nextFound)
      setInput('')
      if (Object.keys(nextFound).length >= 10) finish('won', nextFound, lives)
    } else {
      const nextLives = lives - 1
      setLives(nextLives)
      setShakeInput(true)
      setTimeout(() => setShakeInput(false), 400)
      if (nextLives <= 0) finish('lost', found, 0)
    }
    setInput('')
  }

  if (challenge === undefined) return <p className="text-white/60">Loading…</p>
  if (challenge === null) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <p className="text-white/60">
          {mode === 'today'
            ? "Today's challenge needs a connected Supabase project with seeded content."
            : 'No challenge found for that date (only the last 15 days are available).'}
        </p>
        <Link to="/game/daily-top10/archive" className="mt-3 inline-block text-emerald-glow underline underline-offset-2 text-sm">
          Back to archive
        </Link>
      </div>
    )
  }

  if (mode === 'today' && alreadyPlayed) {
    return (
      <div className="mx-auto max-w-xl text-center glass-card rounded-2xl p-8">
        <p className="text-xs uppercase tracking-wide text-emerald-glow font-semibold">Today · ranked</p>
        <h2 className="font-display text-2xl font-bold text-white mt-2">{challenge.title}</h2>
        <p className="mt-3 text-white/70">
          You've already played today's ranked challenge — {alreadyPlayed.found_count}/10 found,{' '}
          {alreadyPlayed.lives_remaining} lives left.
        </p>
        <p className="mt-1 text-sm text-white/50">Come back tomorrow for a new category, or practice in the archive.</p>
        <Link to="/game/daily-top10/archive" className="mt-4 inline-block text-emerald-glow underline underline-offset-2 text-sm">
          Practice in archive →
        </Link>
      </div>
    )
  }

  const isRankedRun = mode === 'today'

  return (
    <div className="mx-auto max-w-xl">
      {status === 'won' && <Confetti />}

      <div className="mb-4 text-center">
        <p className="text-xs uppercase tracking-wide font-semibold text-emerald-glow">
          {isRankedRun ? 'Today · ranked' : 'Archive · unranked practice'}
        </p>
        <h2 className="font-display text-2xl font-bold text-white mt-1">{challenge.title}</h2>
        <div className="mt-2 flex justify-center gap-1 text-xl" aria-label={`${lives} lives remaining`}>
          {Array.from({ length: START_LIVES }, (_, i) => (
            <span key={i}>{i < lives ? '❤️' : '💔'}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((rank) => (
          <motion.div
            key={rank}
            animate={found[rank] ? { scale: [0.9, 1] } : {}}
            transition={{ duration: 0.3 }}
            className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-2 ${
              found[rank] ? 'border-emerald-glow bg-emerald-glow/15 text-white' : 'border-white/10 bg-white/[0.03] text-white/30'
            }`}
          >
            <span className="font-display font-bold w-5 text-right">{rank}</span>
            <span className="truncate">{found[rank] ?? (status !== 'playing' ? challenge.entries[rank - 1]?.name : '???')}</span>
          </motion.div>
        ))}
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitGuess(input)}
            placeholder="Type a name…"
            className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-glow"
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
            <ShareResult
              gameName="Daily Top 10"
              lines={[
                challenge.title,
                status === 'won' ? `Found 10/10 with ${lives} ❤️ left` : `Found ${Object.keys(found).length}/10`,
              ]}
            />
          </div>
        </div>
      )}
    </div>
  )
}
