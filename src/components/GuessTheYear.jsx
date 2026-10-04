import { useEffect, useState } from 'react'
import { Flame, SoccerBall } from '@phosphor-icons/react'
import { pickWithoutRepeat } from '../lib/sampling'
import { submitScore, getMyHighscore } from '../lib/scores'
import matches from '../data/matches.json'
import GameIntroModal from './GameIntroModal'

const MIN_YEAR = 1955
const MAX_YEAR = 2026
// A guess within this many years keeps the run going; further off ends it.
const MAX_MISS_YEARS = 2

export default function GuessTheYear() {
  const [match, setMatch] = useState(() => pickWithoutRepeat(matches, 'guess_the_year'))
  const [guess, setGuess] = useState(1990)
  const [confirmed, setConfirmed] = useState(false)
  const [diff, setDiff] = useState(0) // years off for the last confirmed guess
  const [streak, setStreak] = useState(0) // hits in a row in the current run
  const [runOver, setRunOver] = useState(false)
  const [highscore, setHighscore] = useState(0) // best run so far

  useEffect(() => {
    getMyHighscore('guess_the_year').then(setHighscore)
  }, [])

  function confirmGuess() {
    if (confirmed || !match) return
    const off = Math.abs(guess - match.year)
    setDiff(off)
    setConfirmed(true)

    if (off <= MAX_MISS_YEARS) {
      const nextStreak = streak + 1
      setStreak(nextStreak)
      // Only a new personal best is stored, so leaving mid-run never loses a record.
      if (nextStreak > highscore) {
        setHighscore(nextStreak)
        submitScore('guess_the_year', nextStreak).catch(() => {})
      }
    } else {
      setRunOver(true)
    }
  }

  function nextRound() {
    setMatch(pickWithoutRepeat(matches, 'guess_the_year'))
    setGuess(1990)
    setConfirmed(false)
    if (runOver) {
      setStreak(0)
      setRunOver(false)
    }
  }

  if (!match) return <p className="text-white/60">Not enough match data to play this game yet.</p>

  return (
    <div className="mx-auto max-w-2xl">
      <GameIntroModal gameKey="guess_the_year" title="Guess the Year">
        <p>You'll see a famous match and its scorers. Drag the slider to guess the year it happened.</p>
        <p>Land within {MAX_MISS_YEARS} years and your streak grows by one. Miss by more and the run ends - the next run starts at zero. Your best streak goes on the leaderboard.</p>
      </GameIntroModal>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold text-white">Guess the Year</h2>
        <div className="text-right">
          <p className="inline-flex items-center gap-1.5 text-2xl font-bold text-orange-glow tabular-nums">
            <Flame weight="fill" /> {streak}
          </p>
          <p className="text-xs text-white/50">Streak · Best: {highscore}</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <p className="text-xs uppercase tracking-wide text-white/40">
          {match.competition}
          {match.stage ? ` - ${match.stage}` : ''}
        </p>
        <h3 className="mt-2 font-display text-2xl font-bold text-white">
          {match.home_team} {match.score} {match.away_team}
        </h3>
        <p className="mt-1 text-sm text-white/50">{match.venue}</p>

        <ul className="mt-4 space-y-1 text-sm text-white/70">
          {match.scorers.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <SoccerBall weight="fill" className="shrink-0 text-orange-glow" />
              {s.player}
              {Number.isFinite(s.minute) ? ` (${s.minute}')` : ''} - {s.team === 'home' ? match.home_team : match.away_team}
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
            className="w-full accent-orange-glow"
          />
          {confirmed && (
            <p className="mt-3 text-center text-sm">
              {!runOver ? (
                <span className="text-orange-glow font-semibold">
                  {diff === 0 ? 'Exact! ' : `Off by ${diff} - still counts. `}It was {match.year}
                </span>
              ) : (
                <span className="text-white/70">
                  Off by {diff} - it was {match.year}. Run over with a streak of {streak}.
                </span>
              )}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          {!confirmed ? (
            <button
              onClick={confirmGuess}
              className="rounded-xl bg-orange-glow px-6 py-2.5 text-sm font-bold text-ink-950 hover:brightness-110 transition"
            >
              Confirm Guess
            </button>
          ) : (
            <button
              onClick={nextRound}
              className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition"
            >
              {runOver ? 'Start a new run →' : 'Next Match →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
