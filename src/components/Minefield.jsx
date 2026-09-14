import { useState } from 'react'
import { motion } from 'framer-motion'
import Confetti from './Confetti'
import { pickWithoutRepeat } from '../lib/sampling'
import { incrementMinefieldsCleared } from '../lib/minefieldStats'
import categories from '../data/minefield_categories.json'

function shuffledTiles(category) {
  const tiles = category.tiles.map((t, i) => ({ ...t, tileId: i }))
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return tiles
}

export default function Minefield() {
  const [category, setCategory] = useState(() => pickWithoutRepeat(categories, 'minefield'))
  const [tiles, setTiles] = useState(() => (category ? shuffledTiles(category) : []))
  const [revealed, setRevealed] = useState({}) // tileId -> true
  const [bombsHit, setBombsHit] = useState(0)
  const [shake, setShake] = useState(false)
  const [status, setStatus] = useState('playing') // playing | won | lost

  const safeRevealedCount = tiles.filter((t) => t.meets_criteria && revealed[t.tileId]).length

  function clickTile(tile) {
    if (status !== 'playing' || revealed[tile.tileId]) return

    setRevealed((r) => ({ ...r, [tile.tileId]: true }))

    if (tile.meets_criteria) {
      const nextSafeCount = safeRevealedCount + 1
      if (nextSafeCount >= 10) {
        setStatus('won')
        incrementMinefieldsCleared()
      }
    } else {
      const nextBombs = bombsHit + 1
      setBombsHit(nextBombs)
      setShake(true)
      setTimeout(() => setShake(false), 450)
      if (nextBombs >= 6) {
        setStatus('lost')
        setRevealed(Object.fromEntries(tiles.map((t) => [t.tileId, true])))
      }
    }
  }

  function playAgain() {
    const next = pickWithoutRepeat(categories, 'minefield')
    setCategory(next)
    setTiles(next ? shuffledTiles(next) : [])
    setRevealed({})
    setBombsHit(0)
    setStatus('playing')
  }

  if (!category) return <p className="text-white/60">Not enough Minefield categories yet.</p>

  return (
    <div className={`mx-auto max-w-3xl ${shake ? 'animate-[shake_0.45s]' : ''}`}>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
      `}</style>

      {status === 'won' && <Confetti />}

      <div className="mb-4 text-center">
        <p className="text-xs uppercase tracking-wide text-emerald-glow font-semibold">Minefield · unranked</p>
        <h2 className="font-display text-2xl font-bold text-white mt-1">{category.title}</h2>
        <p className="mt-1 text-sm font-semibold text-red-400">{bombsHit} of 6 bombs triggered</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map((tile) => {
          const isRevealed = revealed[tile.tileId]
          return (
            <motion.button
              key={tile.tileId}
              onClick={() => clickTile(tile)}
              disabled={status !== 'playing' || isRevealed}
              initial={false}
              animate={isRevealed ? { rotateY: 180 } : { rotateY: 0 }}
              transition={{ duration: 0.35 }}
              style={{ transformStyle: 'preserve-3d' }}
              className={`relative flex h-24 flex-col items-center justify-center rounded-xl border p-2 text-center text-xs font-semibold transition-colors ${
                isRevealed
                  ? tile.meets_criteria
                    ? 'border-emerald-glow bg-emerald-glow/15 text-emerald-glow'
                    : 'border-red-500 bg-red-500/15 text-red-400'
                  : 'border-white/15 bg-white/[0.04] text-white hover:bg-white/10'
              }`}
            >
              <span className="leading-tight">{tile.name}</span>
              {isRevealed && (
                <span className="mt-1 text-[10px] font-normal opacity-80">
                  {tile.meets_criteria ? `✓ ${tile.actual_value}` : `💣 ${tile.actual_value}`}
                </span>
              )}
            </motion.button>
          )
        })}
      </div>

      {status !== 'playing' && (
        <div className="mt-6 text-center">
          <h3 className="font-display text-2xl font-bold text-white">
            {status === 'won' ? 'You cleared the minefield!' : 'Boom — you hit all 6 mines.'}
          </h3>
          <button
            onClick={playAgain}
            className="mt-4 rounded-xl bg-emerald-glow px-6 py-2.5 text-sm font-bold text-ink-950 hover:brightness-110 transition"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  )
}
