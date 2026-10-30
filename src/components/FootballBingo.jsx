import { useEffect, useMemo, useState } from 'react'
import { SquaresFour, X } from '@phosphor-icons/react'
import GameIntroModal from './GameIntroModal'
import ShareResult from './ShareResult'
import { Crest } from './BlindParts'
import { BINGO_PLAYERS, MAX_GUESSES, fitsCell, gridFor, solutionsOf } from '../lib/bingo'
import { todayCET } from '../lib/challengeApi'
import { normalizeSearch } from '../lib/textNormalize'

const storeKey = (date) => `topbin:bingo:${date}`
function load(date) {
  try { return JSON.parse(localStorage.getItem(storeKey(date))) ?? null } catch { return null }
}
function save(date, state) {
  try { localStorage.setItem(storeKey(date), JSON.stringify(state)) } catch { /* private mode: the game still works, only the progress is not kept */ }
}

/** Football Bingo: one 3x3 grid a day, 9 guesses, every footballer only once. */
export default function FootballBingo() {
  const date = todayCET()
  const grid = useMemo(() => gridFor(date), [date])
  const [cells, setCells] = useState(() => load(date)?.cells ?? Array(9).fill(null)) // { id, name } of the footballer put into a cell
  const [guesses, setGuesses] = useState(() => load(date)?.guesses ?? 0)
  const [open, setOpen] = useState(null) // index of the cell being filled
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('')
  const [misses, setMisses] = useState(() => load(date)?.misses ?? Array(9).fill(false)) // a cell that took a wrong guess is shown with a mark
  const filled = cells.filter(Boolean).length
  const over = filled === 9 || guesses >= MAX_GUESSES
  const used = new Set(cells.filter(Boolean).map((c) => c.id))

  useEffect(() => { save(date, { cells, guesses, misses }) }, [date, cells, guesses, misses])

  const q = normalizeSearch(query)
  const matches = q.length < 2 ? [] : BINGO_PLAYERS
    .filter((p) => !used.has(p.id) && normalizeSearch(p.name).includes(q))
    .sort((a, b) => Number(normalizeSearch(b.name).startsWith(q)) - Number(normalizeSearch(a.name).startsWith(q)) || a.name.localeCompare(b.name))
    .slice(0, 7)

  function guess(p) {
    const row = grid.rows[Math.floor(open / 3)], col = grid.cols[open % 3]
    setGuesses(guesses + 1)
    if (fitsCell(p, row, col)) {
      setCells(cells.map((c, i) => (i === open ? { id: p.id, name: p.name } : c)))
      setNote('')
    } else {
      setMisses(misses.map((m, i) => (i === open ? true : m)))
      setNote(`${p.name} does not fit.`)
    }
    setOpen(null)
    setQuery('')
  }

  const shareLines = [`Football Bingo ${date} - ${filled}/9`, ...[0, 1, 2].map((r) => [0, 1, 2].map((c) => (cells[r * 3 + c] ? '🟩' : '⬛')).join(''))]
  const row = open != null ? grid.rows[Math.floor(open / 3)] : null
  const col = open != null ? grid.cols[open % 3] : null

  return (
    <div className="mx-auto max-w-md pb-10">
      <GameIntroModal gameKey="football-bingo" title="Football Bingo">
        <p>Fill the 3x3 grid: tap a field and name a footballer who fits both categories - a club he played for, his nationality or a title he won.</p>
        <p>Every footballer can be used once. You have {MAX_GUESSES} guesses; a wrong one is lost.</p>
      </GameIntroModal>
      <div className="mb-5 mt-2 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-glow text-ink-950">
          <SquaresFour weight="fill" size={26} />
        </span>
        <h1 className="font-display text-4xl font-extrabold text-white">Football Bingo</h1>
        <p className="mt-1 text-sm text-white/50">{date} · {filled}/9 filled · {Math.max(0, MAX_GUESSES - guesses)} guesses left</p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,1.5fr))] gap-1.5">
        <span />
        {grid.cols.map((c) => (
          <span key={c.key} className="flex min-h-[3.25rem] items-center justify-center rounded-xl bg-white/[0.07] px-1 text-center text-xs font-semibold leading-tight text-white">{c.label}</span>
        ))}
        {grid.rows.map((r, ri) => (
          <div key={r.key} className="contents">
            <span className="flex items-center justify-center rounded-xl bg-white/[0.07] px-1 text-center text-xs font-semibold leading-tight text-white">{r.label}</span>
            {[0, 1, 2].map((ci) => {
              const i = ri * 3 + ci
              const c = cells[i]
              return (
                <button
                  key={i}
                  disabled={!!c || over}
                  onClick={() => { setOpen(i); setQuery(''); setNote('') }}
                  className={`flex aspect-square items-center justify-center rounded-xl border p-1 text-center text-xs font-semibold leading-tight transition ${
                    c ? 'border-transparent bg-emerald-500/25 text-white' : misses[i] ? 'border-red-400/40 bg-red-500/10 text-white/50 hover:bg-white/10' : 'border-dashed border-white/20 bg-white/[0.03] text-white/30 hover:bg-white/10'
                  }`}
                >
                  {c ? c.name : over ? `${solutionsOf(r, grid.cols[ci]).length} fit` : '+'}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      {note && <p className="mt-3 text-center text-sm text-red-300">{note}</p>}

      {over && (
        <div className="mt-6 text-center">
          <p className="mb-3 font-display text-2xl font-bold text-white">{filled === 9 ? 'Perfect grid!' : `${filled} of 9`}</p>
          <ShareResult gameName="Football Bingo" lines={shareLines} />
          <p className="mt-3 text-xs text-white/40">A new grid comes every day.</p>
        </div>
      )}

      {open != null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" onClick={() => setOpen(null)}>
          <div className="glass-card relative w-full max-w-sm rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(null)} aria-label="Close" className="absolute right-3 top-3 text-white/50 transition-colors hover:text-white"><X size={20} weight="bold" /></button>
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
                  <button onClick={() => guess(p)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-left transition hover:bg-white/10">
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
      )}
    </div>
  )
}
