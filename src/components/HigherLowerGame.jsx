import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import CountUp from './CountUp'
import Confetti from './Confetti'
import ShareResult from './ShareResult'
import { pickPairWithoutRepeat, pickWithoutRepeat } from '../lib/sampling'
import { submitScore, getMyHighscore } from '../lib/scores'

/**
 * Shared engine for Goal / Market Value / Assist / Transfer Duel (3.5).
 * `renderIdentity` draws the card's player/transfer label,
 * `formatValue` formats the compared attribute for display.
 */
export default function HigherLowerGame({ gameType, dataset, attribute, formatValue, renderIdentity, title, hint }) {
  const [pair, setPair] = useState(() => pickPairWithoutRepeat(dataset, gameType))
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [highscore, setHighscore] = useState(0)
  const [phase, setPhase] = useState('playing') // playing | gameover
  const [shake, setShake] = useState(false)
  const [isNewBest, setIsNewBest] = useState(false)
  const [guess, setGuess] = useState(null)

  useEffect(() => {
    getMyHighscore(gameType).then(setHighscore)
  }, [gameType])

  const [left, right] = pair

  function handleGuess(direction) {
    if (revealed || phase === 'gameover' || !left || !right) return
    setGuess(direction)
    setRevealed(true)

    const leftVal = left[attribute]
    const rightVal = right[attribute]
    const isTie = rightVal === leftVal
    const isCorrect = isTie || (direction === 'higher' ? rightVal > leftVal : rightVal < leftVal)

    setTimeout(async () => {
      if (isCorrect) {
        const nextScore = score + 1
        setScore(nextScore)
        const nextRight = pickWithoutRepeat(
          dataset.filter((d) => d.id !== left.id && d.id !== right.id),
          gameType,
        )
        setPair([right, nextRight ?? right])
        setRevealed(false)
        setGuess(null)
      } else {
        setShake(true)
        setTimeout(async () => {
          setShake(false)
          setPhase('gameover')
          const result = await submitScore(gameType, score)
          setIsNewBest(result.isNewBest)
          if (result.isNewBest) setHighscore(score)
        }, 500)
      }
    }, 900)
  }

  function playAgain() {
    setPair(pickPairWithoutRepeat(dataset, gameType))
    setScore(0)
    setRevealed(false)
    setPhase('playing')
    setGuess(null)
    setIsNewBest(false)
    setShake(false)
  }

  if (!left || !right) {
    return <p className="text-white/60">Not enough data to play this game yet.</p>
  }

  if (phase === 'gameover') {
    return (
      <div className="mx-auto max-w-md text-center">
        {isNewBest && <Confetti />}
        <h2 className="font-display text-3xl font-bold text-white">Game Over</h2>
        <p className="mt-3 text-lg text-white/80">
          You scored <CountUp value={score} />
        </p>
        {isNewBest && <p className="mt-1 text-amber-glow font-semibold">🏆 New personal best!</p>}
        <p className="mt-1 text-sm text-white/50">Best: {Math.max(highscore, score)}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={playAgain}
            className="rounded-xl bg-emerald-glow px-5 py-2.5 text-sm font-semibold text-ink-950 hover:brightness-110 transition"
          >
            Play Again
          </button>
          <ShareResult gameName={title} lines={[`Score: ${score}`, `Best: ${Math.max(highscore, score)}`]} />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-white">{title}</h2>
          {hint && <p className="text-sm text-white/50">{hint}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-emerald-glow tabular-nums">{score}</p>
          <p className="text-xs text-white/50">Best: {highscore}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DuelCard identity={renderIdentity(left)} rawValue={left[attribute]} formatValue={formatValue} revealed />

        <AnimatePresence mode="popLayout">
          <motion.div
            key={right.id}
            initial={{ x: 40, opacity: 0 }}
            animate={{
              x: 0,
              opacity: 1,
              ...(shake ? { x: [0, -8, 8, -8, 8, 0] } : {}),
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <DuelCard
              identity={renderIdentity(right)}
              rawValue={right[attribute]}
              formatValue={formatValue}
              revealed={revealed}
              status={revealed ? (guess && guessCorrectness(guess, left[attribute], right[attribute]) ? 'correct' : 'wrong') : null}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 flex justify-center gap-4">
        <button
          disabled={revealed}
          onClick={() => handleGuess('higher')}
          className="rounded-xl bg-emerald-glow px-6 py-3 text-sm font-bold text-ink-950 hover:brightness-110 transition disabled:opacity-40"
        >
          ▲ Higher
        </button>
        <button
          disabled={revealed}
          onClick={() => handleGuess('lower')}
          className="rounded-xl bg-white/10 px-6 py-3 text-sm font-bold text-white hover:bg-white/20 transition disabled:opacity-40"
        >
          ▼ Lower
        </button>
      </div>
    </div>
  )
}

function guessCorrectness(direction, leftVal, rightVal) {
  return rightVal === leftVal || (direction === 'higher' ? rightVal > leftVal : rightVal < leftVal)
}

function DuelCard({ identity, rawValue, formatValue, revealed, status }) {
  const border =
    status === 'correct'
      ? 'border-emerald-glow shadow-emerald-glow/30'
      : status === 'wrong'
        ? 'border-red-500 shadow-red-500/30'
        : 'border-white/10'

  return (
    <div className={`glass-card rounded-2xl p-6 text-center min-h-56 flex flex-col justify-between border transition-colors duration-300 ${border} shadow-lg`}>
      <div>{identity}</div>
      <div className="mt-4 font-display text-3xl font-bold text-white">
        {revealed ? <CountUp value={rawValue} format={formatValue} /> : '???'}
      </div>
    </div>
  )
}
