import { useState } from 'react'
import { pickWithoutRepeat } from '../lib/sampling'
import { submitScore, getMyHighscore } from '../lib/scores'
import { useEffect } from 'react'
import matches from '../data/matches.json'

const MIN_YEAR = 1955
const MAX_YEAR = 2026

function pointsFor(guess, actual) {
  const diff = Math.abs(guess - actual)
  if (diff === 0) return 100
  if (diff === 1) return 50
  if (diff === 2) return 20
  return 0
}

export default function GuessTheYear() {
  const [match, setMatch] = useState(() => pickWithoutRepeat(matches, 'guess_the_year'))
  const [guess, setGuess] = useState(1990)
  const [confirmed, setConfirmed] = useState(false)
  const [lastPoints, setLastPoints] = useState(0)
  const [score, setScore] = useState(0)
  const [highscore, setHighscore] = useState(0)

  useEffect(() => {
    getMyHighscore('guess_the_year').then(setHighscore)
  }, [])

  function confirmGuess() {
    if (confirmed || !match) return
    const points = pointsFor(guess, match.year)
    setLastPoints(points)
    setConfirmed(true)
    const nextScore = score + points

    setTimeout(async () => {
      setScore(nextScore)
      // Cumulative session score, clamped to the shared highscores 0-1000
      // range (10 perfect guesses) — see supabase/schema.sql check constraint.
      const clamped = Math.min(nextScore, 1000)
      const result = await submitScore('guess_the_year', clamped)
      if (result.isNewBest) setHighscore(clamped)
    }, 600)
  }

  function nextRound() {
    setMatch(pickWithoutRepeat(matches, 'guess_the_year'))
    setGuess(1990)
    setConfirmed(false)
  }

  if (!match) return <p className="text-white/60">Not enough match data to play this game yet.</p>

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold text-white">Guess the Year</h2>
        <div className="text-right">
          <p className="text-2xl font-bold text-emerald-glow tabular-nums">{score}</p>
          <p className="text-xs text-white/50">Best: {highscore}</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <p className="text-xs uppercase tracking-wide text-white/40">
          {match.competition}
          {match.stage ? ` — ${match.stage}` : ''}
        </p>
        <h3 className="mt-2 font-display text-2xl font-bold text-white">
          {match.home_team} {match.score} {match.away_team}
        </h3>
        <p className="mt-1 text-sm text-white/50">{match.venue}</p>

        <ul className="mt-4 space-y-1 text-sm text-white/70">
          {match.scorers.map((s, i) => (
            <li key={i}>
              ⚽ {s.player}
              {Number.isFinite(s.minute) ? ` (${s.minute}')` : ''} — {s.team === 'home' ? match.home_team : match.away_team}
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <div className="flex items-center justify-between text-sm text-white/60 mb-2">
            <span>{MIN_YEAR}</span>
            <span className="font-display text-3xl font-bold text-white tabular-nums">{guess}</span>
            <span>{MAX_YEAR}</span>
          </div>
          <input
            type="range"
            aria-label="Guess the year"
            min={MIN_YEAR}
            max={MAX_YEAR}
            value={confirmed ? match.year : guess}
            disabled={confirmed}
            onChange={(e) => setGuess(Number(e.target.value))}
            className="w-full accent-emerald-glow"
          />
          {confirmed && (
            <p className="mt-3 text-center text-sm">
              {lastPoints > 0 ? (
                <span className="text-emerald-glow font-semibold">
                  {lastPoints === 100 ? 'Exact! ' : ''}+{lastPoints} points — it was {match.year}
                </span>
              ) : (
                <span className="text-white/60">Not quite — it was {match.year}</span>
              )}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          {!confirmed ? (
            <button
              onClick={confirmGuess}
              className="rounded-xl bg-emerald-glow px-6 py-2.5 text-sm font-bold text-ink-950 hover:brightness-110 transition"
            >
              Confirm Guess
            </button>
          ) : (
            <button
              onClick={nextRound}
              className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition"
            >
              Next Match →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
