import { useState } from 'react'
import { motion } from 'framer-motion'
import { CaretLeft, CaretRight, Eye, EyeSlash, Skull, SoccerBall } from '@phosphor-icons/react'
import GameIntroModal from './GameIntroModal'
import players from '../data/players.json'

const MIN_PLAYERS = 3
const MAX_PLAYERS = 12
// Recognizable-enough that a one-word association is actually playable -
// this app's occasional obscure historical additions (no market value set)
// are naturally excluded by this filter too.
const PLAYER_POOL = players.filter((p) => Number.isFinite(p.market_value_eur) && p.market_value_eur >= 30_000_000)

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function Imposter() {
  const [phase, setPhase] = useState('setup') // setup | reveal | done
  const [count, setCount] = useState(4)
  const [names, setNames] = useState(['', '', '', ''])
  const [participants, setParticipants] = useState([])
  const [secretPlayer, setSecretPlayer] = useState(null)
  const [imposterIndex, setImposterIndex] = useState(null)
  const [turnIndex, setTurnIndex] = useState(0)
  const [cardStage, setCardStage] = useState('pass') // pass | faceDown | revealed
  const [answerRevealed, setAnswerRevealed] = useState(false)

  function setCountAndResize(n) {
    const clamped = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n))
    setCount(clamped)
    setNames((prev) => {
      const next = prev.slice(0, clamped)
      while (next.length < clamped) next.push('')
      return next
    })
  }

  function startGame() {
    const finalNames = names.map((n, i) => n.trim() || `Player ${i + 1}`)
    setParticipants(finalNames)
    setSecretPlayer(randomFrom(PLAYER_POOL))
    setImposterIndex(Math.floor(Math.random() * finalNames.length))
    setTurnIndex(0)
    setCardStage('pass')
    setAnswerRevealed(false)
    setPhase('reveal')
  }

  function revealCard() {
    setCardStage('revealed')
  }

  function nextTurn() {
    if (turnIndex + 1 >= participants.length) {
      setPhase('done')
    } else {
      setTurnIndex((i) => i + 1)
      setCardStage('pass')
    }
  }

  function playAgainSamePlayers() {
    setSecretPlayer(randomFrom(PLAYER_POOL))
    setImposterIndex(Math.floor(Math.random() * participants.length))
    setTurnIndex(0)
    setCardStage('pass')
    setAnswerRevealed(false)
    setPhase('reveal')
  }

  function changePlayers() {
    setPhase('setup')
  }

  if (phase === 'setup') {
    return (
      <div className="mx-auto max-w-md">
        <GameIntroModal gameKey="imposter" title="Imposter">
          <p>A pass-the-phone party game. Everyone but one secret Imposter sees the same football player's card.</p>
          <p>Go around, each say one word connected to the player. After two rounds, vote out who you think the Imposter is - all out loud, no phone needed for that part.</p>
        </GameIntroModal>

        <h2 className="font-display text-2xl font-bold text-white mb-1">Imposter</h2>
        <p className="text-sm text-white/50 mb-6">Set up your players, then pass the phone around.</p>

        <label className="block text-sm text-white/70 mb-1">Number of players</label>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setCountAndResize(count - 1)}
            disabled={count <= MIN_PLAYERS}
            className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20 transition disabled:opacity-30"
          >
            <CaretLeft weight="bold" />
          </button>
          <span className="font-display text-2xl font-bold text-white w-10 text-center">{count}</span>
          <button
            onClick={() => setCountAndResize(count + 1)}
            disabled={count >= MAX_PLAYERS}
            className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20 transition disabled:opacity-30"
          >
            <CaretRight weight="bold" />
          </button>
        </div>

        <label className="block text-sm text-white/70 mb-2">Player names</label>
        <div className="space-y-2 mb-6">
          {names.map((name, i) => (
            <input
              key={i}
              value={name}
              onChange={(e) =>
                setNames((prev) => prev.map((n, idx) => (idx === i ? e.target.value : n)))
              }
              placeholder={`Player ${i + 1}`}
              className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-orange-glow"
            />
          ))}
        </div>

        <button
          onClick={startGame}
          className="w-full rounded-xl bg-orange-glow px-4 py-3 text-sm font-bold text-ink-950 hover:brightness-110 transition"
        >
          Start Game
        </button>
      </div>
    )
  }

  if (phase === 'reveal') {
    const currentName = participants[turnIndex]
    const isImposter = turnIndex === imposterIndex

    if (cardStage === 'pass') {
      return (
        <div className="mx-auto max-w-sm text-center">
          <p className="text-xs uppercase tracking-wide text-orange-glow font-semibold mb-2">
            Player {turnIndex + 1} of {participants.length}
          </p>
          <h2 className="font-display text-3xl font-bold text-white mb-3">Pass to {currentName}</h2>
          <p className="text-sm text-white/60 mb-8">Everyone else look away - only {currentName} should see the screen now.</p>
          <button
            onClick={() => setCardStage('faceDown')}
            className="w-full rounded-xl bg-orange-glow px-4 py-3 text-sm font-bold text-ink-950 hover:brightness-110 transition"
          >
            I'm {currentName}, I'm ready
          </button>
        </div>
      )
    }

    return (
      <div className="mx-auto max-w-sm text-center">
        <p className="text-xs uppercase tracking-wide text-orange-glow font-semibold mb-4">{currentName}'s card</p>

        <div className="relative mx-auto h-64 w-full max-w-xs" style={{ perspective: 1200 }}>
          <motion.div
            className="relative h-full w-full cursor-pointer [transform-style:preserve-3d]"
            animate={{ rotateY: cardStage === 'revealed' ? 180 : 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => cardStage === 'faceDown' && revealCard()}
          >
            <div className="glass-card absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/15 [backface-visibility:hidden]">
              <SoccerBall size={40} className="text-white/30" />
              <p className="text-sm text-white/50">Tap to reveal</p>
            </div>

            <div
              className={`absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 [backface-visibility:hidden] ${
                isImposter ? 'border-red-500 bg-red-500/10' : 'border-orange-glow bg-orange-glow/10'
              }`}
              style={{ transform: 'rotateY(180deg)' }}
            >
              {isImposter ? (
                <>
                  <Skull weight="fill" size={40} className="text-red-400" />
                  <p className="font-display text-2xl font-bold text-red-400">IMPOSTER</p>
                  <p className="text-xs text-white/50">You don't know the player - bluff your way through!</p>
                </>
              ) : (
                <>
                  <SoccerBall weight="fill" size={32} className="text-orange-glow" />
                  <p className="font-display text-2xl font-bold text-white text-center leading-tight">{secretPlayer.name}</p>
                  <p className="text-xs text-white/50">{secretPlayer.club}</p>
                </>
              )}
            </div>
          </motion.div>
        </div>

        {cardStage === 'revealed' && (
          <div className="mt-6">
            <p className="text-xs text-white/40 mb-3">Don't let anyone else see - hide it before you pass the phone.</p>
            <button
              onClick={nextTurn}
              className="w-full rounded-xl bg-orange-glow px-4 py-3 text-sm font-bold text-ink-950 hover:brightness-110 transition"
            >
              Hide card & pass it on
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <h2 className="font-display text-3xl font-bold text-white mb-3">Everyone's seen their card!</h2>
      <div className="glass-card rounded-2xl p-6 text-left text-sm text-white/70 leading-relaxed space-y-2 mb-6">
        <p>1. Go around the group - each person says <strong className="text-white">one word</strong> connected to the player. Two rounds.</p>
        <p>2. Then vote out loud: who do you think is the Imposter?</p>
        <p>3. Once you've voted, reveal the answer below.</p>
      </div>

      {!answerRevealed ? (
        <button
          onClick={() => setAnswerRevealed(true)}
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/20 transition inline-flex items-center justify-center gap-2"
        >
          <Eye weight="bold" /> Reveal the answer
        </button>
      ) : (
        <div className="glass-card rounded-2xl p-6 mb-4">
          <p className="text-sm text-white/50 mb-1">The secret player was</p>
          <p className="font-display text-2xl font-bold text-orange-glow mb-4">{secretPlayer.name}</p>
          <p className="text-sm text-white/50 mb-1">The Imposter was</p>
          <p className="font-display text-2xl font-bold text-red-400">{participants[imposterIndex]}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={playAgainSamePlayers}
          className="flex-1 rounded-xl bg-orange-glow px-4 py-2.5 text-sm font-bold text-ink-950 hover:brightness-110 transition"
        >
          Play Again
        </button>
        <button
          onClick={changePlayers}
          className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition inline-flex items-center justify-center gap-2"
        >
          <EyeSlash weight="bold" /> Change Players
        </button>
      </div>
    </div>
  )
}
