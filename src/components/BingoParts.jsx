import { useState } from 'react'
import { Heart, X } from '@phosphor-icons/react'
import { Crest } from './BlindParts'
import { BINGO_PLAYERS, TYPE_NAME, bingoPlayer, solutionsOf } from '../lib/bingo'
import { isOver, scores } from '../lib/bingoGame'
import { PLAYER_COLORS } from '../lib/blindRanking'
import { normalizeSearch } from '../lib/textNormalize'

const Head = ({ cat }) => (
  <span className="flex min-h-[3.25rem] flex-col items-center justify-center rounded-xl bg-white/[0.07] px-1 text-center">
    <span className="text-xs font-semibold leading-tight text-white">{cat.label}</span>
    <span className="mt-0.5 text-[9px] uppercase tracking-wider text-white/35">{TYPE_NAME[cat.type]}</span>
  </span>
)

/** The 3x3 grid. `onCell(i)` is set while a field may be tapped; taken fields show the footballer in the color of the player who took him. */
export function BingoBoard({ grid, state, names, onCell, lastCell = -1 }) {
  const over = isOver(state)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,1.5fr))] gap-1.5">
      <span />
      {grid.cols.map((c) => <Head key={`${c.type}:${c.key}`} cat={c} />)}
      {grid.rows.map((r, ri) => (
        <div key={`${r.type}:${r.key}`} className="contents">
          <Head cat={r} />
          {[0, 1, 2].map((ci) => {
            const i = ri * 3 + ci
            const c = state.cells[i]
            const p = c ? bingoPlayer(c.id) : null
            return (
              <button
                key={i}
                disabled={!!c || !onCell}
                onClick={() => onCell(i)}
                title={c ? `${names[c.seat]}: ${p?.name}` : undefined}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl border p-1 text-center text-xs font-semibold leading-tight transition ${
                  c ? 'border-transparent text-ink-950' : onCell ? 'border-dashed border-white/25 bg-white/[0.04] text-white/40 hover:bg-white/10' : 'border-dashed border-white/10 bg-white/[0.02] text-white/25'
                } ${i === lastCell ? 'ring-2 ring-white/70' : ''}`}
                style={c ? { background: PLAYER_COLORS[c.seat] } : undefined}
              >
                {c ? p?.name : over ? `${solutionsOf(r, grid.cols[ci]).length} fit` : onCell ? '+' : ''}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Whose turn it is and how many lives everybody has left. */
export function TurnBar({ state, names }) {
  const over = isOver(state)
  return (
    <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
      {state.lives.map((l, s) => {
        const on = !over && state.seat === s
        return (
          <span key={s} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold transition ${on ? 'border-white/60 text-ink-950' : 'border-white/10 bg-white/[0.04] text-white/70'} ${l <= 0 ? 'opacity-40' : ''}`} style={on ? { background: PLAYER_COLORS[s] } : undefined}>
            {!on && <span className="h-2 w-2 rounded-full" style={{ background: PLAYER_COLORS[s] }} />}
            <span className="max-w-[7rem] truncate">{names[s]}</span>
            <span className="inline-flex items-center gap-0.5"><Heart weight="fill" size={13} />{l}</span>
          </span>
        )
      })}
    </div>
  )
}

/** The pop-up to name a footballer for the chosen field. */
export function GuessSheet({ grid, cell, used, onGuess, onClose }) {
  const [query, setQuery] = useState('')
  const row = grid.rows[Math.floor(cell / 3)], col = grid.cols[cell % 3]
  const q = normalizeSearch(query)
  const usedSet = new Set(used)
  const matches = q.length < 2 ? [] : BINGO_PLAYERS
    .filter((p) => !usedSet.has(p.id) && normalizeSearch(p.name).includes(q))
    .sort((a, b) => Number(normalizeSearch(b.name).startsWith(q)) - Number(normalizeSearch(a.name).startsWith(q)) || a.name.localeCompare(b.name))
    .slice(0, 7)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="glass-card relative w-full max-w-sm rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 text-white/50 transition-colors hover:text-white"><X size={20} weight="bold" /></button>
        <p className="pr-6 text-xs font-semibold uppercase tracking-wider text-white/45">Who fits both?</p>
        <p className="mb-3 font-display text-lg font-bold text-white">{row.label} <span className="text-white/40">+</span> {col.label}</p>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a footballer ..."
          autoComplete="off"
          className="mb-2 w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 focus:border-orange-glow focus:outline-none"
        />
        <ul className="space-y-1.5">
          {matches.map((p) => (
            <li key={p.id}>
              <button onClick={() => onGuess(p)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-left transition hover:bg-white/10">
                <Crest p={p} size="h-5 w-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-white">{p.name}</span>
                  <span className="block truncate text-xs text-white/45">{p.club} · {p.nationality}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {q.length >= 2 && matches.length === 0 && <p className="px-1 text-sm text-white/40">Nobody found - or already used.</p>}
      </div>
    </div>
  )
}

/** The verdict under the board once the game is over. */
export function Verdict({ state, names }) {
  const { rows, winners } = scores(state)
  if (state.count === 1) {
    const f = rows[0].fields
    return <p className="mb-3 font-display text-2xl font-bold text-white">{f === 9 ? 'Perfect grid!' : `${f} of 9`}</p>
  }
  return (
    <div className="mb-3 text-center">
      <p className="font-display text-2xl font-bold text-white">{winners.length > 1 ? 'A tie!' : `${names[winners[0]]} wins!`}</p>
      <p className="mt-1 text-sm text-white/55">{rows.map((r) => `${names[r.seat]} ${r.fields}`).join(' · ')}</p>
    </div>
  )
}
