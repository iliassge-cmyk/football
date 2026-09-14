import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import CountUp from './CountUp'
import Confetti from './Confetti'
import ShareResult from './ShareResult'
import { pickPairWithoutRepeat, pickWithoutRepeat } from '../lib/sampling'
import { submitScore, getMyHighscore } from '../lib/scores'

const REVEAL_MS = 900 // CountUp duration + a beat to land
const HOLD_CORRECT_MS = 750 // time to admire the glow before the next round
const SHAKE_MS = 600

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

    if (isCorrect) {
      setTimeout(async () => {
        const nextScore = score + 1
        setScore(nextScore)
        const nextRight = pickWithoutRepeat(
          dataset.filter((d) => d.id !== left.id && d.id !== right.id),
          gameType,
        )
        setPair([right, nextRight ?? right])
        setRevealed(false)
        setGuess(null)
      }, REVEAL_MS + HOLD_CORRECT_MS)
    } else {
      setTimeout(() => {
        setShake(true)
        setTimeout(async () => {
          setShake(false)
          setPhase('gameover')
          const result = await submitScore(gameType, score)
          setIsNewBest(result.isNewBest)
          if (result.isNewBest) setHighscore(score)
        }, SHAKE_MS)
      }, REVEAL_MS)
    }
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
        <motion.h2
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="font-display text-3xl font-bold text-white"
        >
          Game Over
        </motion.h2>
        <p className="mt-3 text-lg text-white/80">
          You scored <CountUp value={score} />
        </p>
        {isNewBest && <p className="mt-1 text-amber-glow font-semibold">🏆 New personal best!</p>}
        <p className="mt-1 text-sm text-white/50">Best: {Math.max(highscore, score)}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={playAgain}
            className="rounded-xl bg-orange-glow px-5 py-2.5 text-sm font-semibold text-ink-950 hover:brightness-110 transition"
          >
            Play Again
          </button>
          <ShareResult gameName={title} lines={[`Score: ${score}`, `Best: ${Math.max(highscore, score)}`]} />
        </div>
      </div>
    )
  }

  const rightStatus = revealed ? (guess && guessCorrectness(guess, left[attribute], right[attribute]) ? 'correct' : 'wrong') : null

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-white">{title}</h2>
          {hint && <p className="text-sm text-white/50">{hint}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-orange-glow tabular-nums">{score}</p>
          <p className="text-xs text-white/50">Best: {highscore}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={left.id}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <DuelCard identity={renderIdentity(left)} rawValue={left[attribute]} formatValue={formatValue} revealed staticValue />
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          <motion.div
            key={right.id}
            initial={{ x: 56, opacity: 0, scale: 0.96 }}
            animate={{
              x: shake ? [0, -10, 10, -8, 8, -4, 4, 0] : 0,
              opacity: 1,
              scale: 1,
            }}
            transition={{
              x: shake ? { duration: SHAKE_MS / 1000, ease: 'easeInOut' } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.45 },
              scale: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
            }}
          >
            <DuelCard
              identity={renderIdentity(right)}
              rawValue={right[attribute]}
              formatValue={formatValue}
              revealed={revealed}
              status={rightStatus}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 flex justify-center gap-4">
        <button
          disabled={revealed}
          onClick={() => handleGuess('higher')}
          className="rounded-xl bg-orange-glow px-6 py-3 text-sm font-bold text-ink-950 hover:brightness-110 active:scale-95 transition disabled:opacity-40"
        >
          ▲ Higher
        </button>
        <button
          disabled={revealed}
          onClick={() => handleGuess('lower')}
          className="rounded-xl bg-white/10 px-6 py-3 text-sm font-bold text-white hover:bg-white/20 active:scale-95 transition disabled:opacity-40"
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

function DuelCard({ identity, rawValue, formatValue, revealed, status, staticValue }) {
  const glow =
    status === 'correct'
      ? { boxShadow: ['0 0 0px rgba(251,122,36,0)', '0 0 36px rgba(251,122,36,0.55)', '0 0 14px rgba(251,122,36,0.25)'] }
      : status === 'wrong'
        ? { boxShadow: ['0 0 0px rgba(239,68,68,0)', '0 0 36px rgba(239,68,68,0.55)', '0 0 14px rgba(239,68,68,0.2)'] }
        : { boxShadow: '0 0 0px rgba(0,0,0,0)' }

  const border =
    status === 'correct' ? 'border-orange-glow' : status === 'wrong' ? 'border-red-500' : 'border-white/10'

  return (
    <motion.div
      animate={glow}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className={`glass-card relative rounded-2xl p-6 text-center min-h-56 flex flex-col justify-between border transition-colors duration-500 ${border} shadow-lg`}
    >
      {status && (
        <motion.span
          initial={{ scale: 0, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4, ease: 'backOut' }}
          className={`absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold shadow-lg ${
            status === 'correct' ? 'bg-orange-glow text-ink-950' : 'bg-red-500 text-white'
          }`}
        >
          {status === 'correct' ? '✓' : '✕'}
        </motion.span>
      )}
      <div>{identity}</div>
      <div className="mt-4 font-display text-3xl font-bold text-white">
        {staticValue ? (
          formatValue(rawValue)
        ) : revealed ? (
          <CountUp value={rawValue} format={formatValue} />
        ) : (
          <span className="tracking-widest text-white/40">???</span>
        )}
      </div>
    </motion.div>
  )
}
