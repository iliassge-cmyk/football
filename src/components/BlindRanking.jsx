import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowsLeftRight, CaretRight, Check, Crown, DiceFive, ListNumbers, X } from '@phosphor-icons/react'
import GameIntroModal from './GameIntroModal'
import { cleanName } from '../lib/bwIdentity'
import { containsProfanity } from '../lib/profanity'
import {
  COUNTRY_CHOICES,
  DEFAULT_FILTERS,
  LEAGUE_CHOICES,
  POSITION_OPTIONS,
  SUGGESTIONS,
  accuracy,
  averageOrder,
  biggestMiss,
  buildPool,
  drawSequence,
  filterSummary,
} from '../lib/blindRanking'

const SILHOUETTE = '/assets/silhouettes/striker_1.svg'
const CLUB_PLACEHOLDER = '/assets/clubs/placeholder.svg'
const SETTINGS_KEY = 'topbin-blind-ranking'
const PLAYER_COLORS = ['#fb7a24', '#4fc3ff', '#a3e635', '#f472b6']
const spring = { type: 'spring', stiffness: 420, damping: 34 }

function readSettings() {
  const base = { count: 1, length: 10, names: ['', '', '', ''], filters: DEFAULT_FILTERS }
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
    if (!s) return base
    const filters = { ...DEFAULT_FILTERS, ...(s.filters ?? {}) }
    if (filters.country !== 'any' && !COUNTRY_CHOICES.includes(filters.country)) filters.country = 'any' // saved by an older version
    return { ...base, ...s, filters }
  } catch {
    return base
  }
}

function Crest({ p, size = 'h-4 w-4' }) {
  return (
    <img
      src={p.club_crest_url || CLUB_PLACEHOLDER}
      alt=""
      className={size}
      onError={(e) => {
        e.currentTarget.src = CLUB_PLACEHOLDER
      }}
    />
  )
}

/** iOS style segmented control: one row, the active choice is a sliding pill. */
function Segmented({ options, value, onChange, label }) {
  const id = useId()
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-white/10 p-1">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`relative z-10 flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${on ? 'text-ink-950' : 'text-white/70'}`}
          >
            {on && <motion.span layoutId={id} transition={spring} className="absolute inset-0 -z-10 rounded-lg bg-white" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Chip({ on, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition active:scale-95 ${
        on ? 'border-white bg-white text-ink-950' : 'border-white/15 bg-white/[0.06] text-white/80 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

function Sheet({ open, onClose, title, subtitle, tone, children, footer }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-label={title}
            className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-3xl border border-white/10 bg-ink-900"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">{title}</h2>
                {subtitle && <p className={`text-sm ${tone === 'bad' ? 'text-red-300' : tone === 'warn' ? 'text-amber-glow' : 'text-white/55'}`}>{subtitle}</p>}
              </div>
              <button onClick={onClose} className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-ink-950 active:scale-95">
                Done
              </button>
            </div>
            <div className="space-y-5 overflow-y-auto px-5 py-5">{children}</div>
            {footer && <div className="border-t border-white/10 px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function FilterGroup({ title, children }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  )
}

// ---- 1. setup -----------------------------------------------------------------------------------------------------------------------------------
function Setup({ onStart }) {
  const [settings, setSettings] = useState(readSettings)
  const [category, setCategory] = useState('')
  const [sheet, setSheet] = useState(false)
  const [hint] = useState(() => SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)])
  const { count, length, names, filters } = settings
  const pool = useMemo(() => buildPool(filters), [filters])
  const enough = pool.length >= length
  const topic = category.trim()
  const badTopic = topic && containsProfanity(topic)

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      // not saving settings is fine
    }
  }, [settings])
  const set = (patch) => setSettings((s) => ({ ...s, ...patch }))
  const setFilter = (patch) => set({ filters: { ...filters, ...patch } })

  function start() {
    const finalTopic = topic || SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)]
    onStart({
      category: finalTopic,
      length,
      names: Array.from({ length: count }, (_, i) => cleanName(names[i], count === 1 ? 'You' : `Player ${i + 1}`)),
      pool,
    })
  }

  const poolText = `${pool.length} ${pool.length === 1 ? 'footballer' : 'footballers'}`
  return (
    <div className="mx-auto max-w-md pb-10 pt-2">
      <GameIntroModal gameKey="blind-ranking" title="Blind Ranking">
        <p>A footballer appears. Put him on a rank right away - you don't know who comes next, and there is no going back.</p>
        <p>Pick any topic. When everyone is done, you settle the real ranking together and see whose blind ranking was closest.</p>
      </GameIntroModal>

      <div className="mb-8 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-glow text-ink-950">
          <ListNumbers weight="fill" size={26} />
        </span>
        <h1 className="font-display text-4xl font-extrabold text-white">Blind Ranking</h1>
      </div>

      <label htmlFor="br-topic" className="mb-1 block text-sm font-semibold text-white/55">
        What are we ranking?
      </label>
      <input
        id="br-topic"
        value={category}
        onChange={(e) => setCategory(e.target.value.slice(0, 60))}
        placeholder={hint}
        autoComplete="off"
        className="w-full border-b border-white/20 bg-transparent pb-2 font-display text-3xl font-bold text-white placeholder:text-white/25 focus:border-orange-glow focus:outline-none"
      />
      {badTopic ? (
        <p className="mt-2 text-sm text-red-300">Please pick a different topic.</p>
      ) : (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
          <Chip onClick={() => setCategory(SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)])}>
            <span className="inline-flex items-center gap-1.5">
              <DiceFive weight="fill" size={15} /> Surprise me
            </span>
          </Chip>
          {SUGGESTIONS.map((s) => (
            <Chip key={s} on={category === s} onClick={() => setCategory(s)}>
              {s}
            </Chip>
          ))}
        </div>
      )}

      <div className="mt-8 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        <div className="space-y-2 px-4 py-3">
          <p className="text-sm font-semibold text-white/55">Who's playing</p>
          <Segmented
            label="Players"
            value={count}
            onChange={(v) => set({ count: v })}
            options={[
              { value: 1, label: 'Just me' },
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
            ]}
          />
          {count > 1 && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              {Array.from({ length: count }, (_, i) => (
                <input
                  key={i}
                  value={names[i] ?? ''}
                  onChange={(e) => set({ names: names.map((n, k) => (k === i ? e.target.value.slice(0, 20) : n)) })}
                  placeholder={`Player ${i + 1}`}
                  aria-label={`Name of player ${i + 1}`}
                  className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-glow"
                />
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2 px-4 py-3">
          <p className="text-sm font-semibold text-white/55">Length</p>
          <Segmented
            label="Length"
            value={length}
            onChange={(v) => set({ length: v })}
            options={[
              { value: 5, label: 'Quick · 5' },
              { value: 10, label: 'Full · 10' },
            ]}
          />
        </div>
        <button onClick={() => setSheet(true)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04] active:bg-white/[0.08]">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white/55">Footballers</span>
            <span className="block truncate font-medium text-white">{filterSummary(filters)}</span>
          </span>
          <span className={`shrink-0 text-sm ${enough ? 'text-white/45' : 'text-red-300'}`}>{poolText}</span>
          <CaretRight size={16} className="shrink-0 text-white/35" />
        </button>
      </div>

      {!enough && <p className="mt-3 text-center text-sm text-red-300">You need at least {length} footballers. Loosen the filters.</p>}
      <button
        onClick={start}
        disabled={!enough || badTopic}
        className="mt-5 w-full rounded-2xl bg-orange-glow py-4 font-display text-xl font-bold text-ink-950 transition enabled:hover:brightness-110 enabled:active:scale-[0.99] disabled:opacity-35"
      >
        Start
      </button>
      {!topic && enough && <p className="mt-2 text-center text-xs text-white/35">No topic? We'll pick one for you.</p>}

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Footballers"
        subtitle={!enough ? `${poolText} - need at least ${length}` : pool.length < length * 2 ? `${poolText} - rounds will look alike` : poolText}
        tone={!enough ? 'bad' : pool.length < length * 2 ? 'warn' : ''}
        footer={
          <button onClick={() => setFilter(DEFAULT_FILTERS)} className="text-sm font-semibold text-orange-glow disabled:opacity-40" disabled={filterSummary(filters) === 'All footballers'}>
            Reset
          </button>
        }
      >
        <FilterGroup title="League">
          {LEAGUE_CHOICES.map((o) => (
            <Chip key={o.id} on={filters.league === o.id} onClick={() => setFilter({ league: o.id })}>
              {o.label}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup title="Country">
          <Chip on={filters.country === 'any'} onClick={() => setFilter({ country: 'any' })}>
            Any
          </Chip>
          {COUNTRY_CHOICES.map((c) => (
            <Chip key={c} on={filters.country === c} onClick={() => setFilter({ country: c })}>
              {c}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup title="Position">
          {POSITION_OPTIONS.map((o) => (
            <Chip key={o.id} on={filters.position === o.id} onClick={() => setFilter({ position: o.id })}>
              {o.label}
            </Chip>
          ))}
        </FilterGroup>
        <label className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.05] px-4 py-3">
          <span>
            <span className="block text-sm font-semibold text-white">Include legends</span>
            <span className="block text-xs text-white/45">Retired players like Zidane or Maldini</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={filters.legends}
            onChange={(e) => setFilter({ legends: e.target.checked })}
            className="h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-white/20 transition checked:bg-green-500 relative before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition checked:before:translate-x-5"
          />
        </label>
      </Sheet>
    </div>
  )
}

// ---- 2. pass the phone ---------------------------------------------------------------------------------------------------------------------------
function PassPhone({ name, color, first, onReady }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring} className="flex h-24 w-24 items-center justify-center rounded-full font-display text-5xl font-extrabold text-ink-950" style={{ background: color }}>
        {name.slice(0, 1).toUpperCase()}
      </motion.div>
      <p className="mt-6 text-white/55">{first ? 'First up' : 'Pass the phone to'}</p>
      <h2 className="font-display text-4xl font-extrabold text-white">{name}</h2>
      <p className="mt-2 text-sm text-white/40">The other rankings stay hidden.</p>
      <button onClick={onReady} className="mt-8 w-full rounded-2xl bg-orange-glow py-4 font-display text-xl font-bold text-ink-950 active:scale-[0.99]">
        I'm ready
      </button>
    </div>
  )
}

// ---- 3. play: one footballer at a time, place him on a free rank ------------------------------------------------------------------------
function Play({ category, name, color, count, sequence, length, onFinish, onQuit }) {
  const [step, setStep] = useState(0)
  const [board, setBoard] = useState(() => Array(length).fill(null))
  const [picked, setPicked] = useState(null)
  const done = step >= length
  const current = sequence[step]
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  function lock(slot) {
    if (done || board[slot]) return
    const next = board.map((x, i) => (i === slot ? current.id : x))
    setBoard(next)
    setPicked(null)
    setStep(step + 1)
    if (step + 1 >= length) timer.current = setTimeout(() => onFinish(next), 900)
  }
  const byId = useMemo(() => new Map(sequence.map((p) => [p.id, p])), [sequence])

  return (
    <div className="mx-auto max-w-md pb-24">
      <div className="mb-3 flex items-center justify-between text-sm">
        <button onClick={() => window.confirm('Quit this round?') && onQuit()} className="rounded-full p-1 text-white/45 hover:text-white" aria-label="Quit">
          <X size={20} />
        </button>
        <span className="flex items-center gap-2 font-semibold text-white/70">
          {count > 1 && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
          {count > 1 ? `${name} · ` : ''}
          {Math.min(step + 1, length)} / {length}
        </span>
        <span className="w-7" />
      </div>
      <h2 className="mb-4 text-center font-display text-3xl font-extrabold leading-tight text-white">{category}</h2>

      <div className="sticky top-2 z-10 mb-4 h-[132px]">
        <AnimatePresence mode="popLayout">
          {!done && (
            <motion.div
              key={current.id}
              initial={{ y: 30, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.96 }}
              transition={spring}
              className="flex h-full items-center gap-4 rounded-3xl border border-white/15 bg-ink-800/95 px-5 shadow-xl shadow-black/40 backdrop-blur"
            >
              <img src={SILHOUETTE} alt="" className="h-16 w-16 shrink-0 opacity-80" />
              <div className="min-w-0">
                <p className="truncate font-display text-3xl font-extrabold leading-tight text-white">{current.name}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-white/65">
                  <Crest p={current} />
                  <span className="truncate">{current.club.replace(/\s*\(retired\)$/i, '')}</span>
                </p>
                <p className="text-xs text-white/40">
                  {current.nationality} · {current.position}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-white/35">Top</p>
      <ol className="space-y-1.5">
        {board.map((id, i) => {
          const p = id ? byId.get(id) : null
          const on = picked === i
          return (
            <li key={i}>
              <button
                disabled={!!p || done}
                onClick={() => (on ? lock(i) : setPicked(i))}
                className={`flex h-12 w-full items-center gap-3 rounded-xl border px-3 text-left transition ${
                  p ? 'border-transparent bg-white/10' : on ? 'border-orange-glow bg-orange-glow/15' : 'border-dashed border-white/15 hover:bg-white/[0.05]'
                }`}
              >
                <span className={`w-6 text-center font-display text-xl font-bold ${p ? 'text-white/40' : on ? 'text-orange-glow' : 'text-white/45'}`}>{i + 1}</span>
                {p ? (
                  <>
                    <Crest p={p} size="h-5 w-5" />
                    <span className="truncate font-semibold text-white">{p.name}</span>
                  </>
                ) : (
                  <span className={`text-sm ${on ? 'font-semibold text-orange-glow' : 'text-white/25'}`}>{on ? 'Tap again to lock in' : ''}</span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-white/35">Bottom</p>

      <AnimatePresence>
        {picked !== null && !done && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={spring} className="fixed inset-x-0 bottom-4 z-20 mx-auto max-w-md px-4">
            <button onClick={() => lock(picked)} className="w-full rounded-2xl bg-orange-glow py-4 font-display text-xl font-bold text-ink-950 shadow-xl shadow-black/50 active:scale-[0.99]">
              Lock in at #{picked + 1}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---- 4. settle the real ranking together ---------------------------------------------------------------------------------------------------
function Settle({ category, names, boards, sequence, initial, onDone }) {
  const [order, setOrder] = useState(initial)
  const [sel, setSel] = useState(null)
  const byId = useMemo(() => new Map(sequence.map((p) => [p.id, p])), [sequence])
  const multi = boards.length > 1

  function tap(id) {
    if (sel === null) return setSel(id)
    if (sel === id) return setSel(null)
    setOrder((o) => o.map((x) => (x === sel ? id : x === id ? sel : x)))
    setSel(null)
  }
  return (
    <div className="mx-auto max-w-md pb-24">
      <h2 className="font-display text-3xl font-extrabold text-white">{multi ? 'Settle it.' : 'Now you know them.'}</h2>
      <p className="mb-1 mt-1 text-white/60">
        {multi ? `Agree on the real ranking for "${category}".` : `Rank them again for "${category}" - this time with full knowledge.`}
      </p>
      <p className="mb-4 flex items-center gap-1.5 text-sm text-white/40">
        <ArrowsLeftRight size={15} /> Tap two footballers to swap them.
      </p>
      {multi && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
          {names.map((n, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLAYER_COLORS[i] }} />
              {n}
            </span>
          ))}
        </div>
      )}
      <ol className="space-y-1.5">
        {order.map((id, i) => {
          const p = byId.get(id)
          const on = sel === id
          return (
            <motion.li layout transition={spring} key={id}>
              <button
                onClick={() => tap(id)}
                className={`flex h-14 w-full items-center gap-3 rounded-xl border px-3 text-left transition ${on ? 'border-orange-glow bg-orange-glow/15' : 'border-transparent bg-white/10'}`}
              >
                <span className="w-6 text-center font-display text-xl font-bold text-white/45">{i + 1}</span>
                <Crest p={p} size="h-5 w-5" />
                <span className="min-w-0 flex-1 truncate font-semibold text-white">{p.name}</span>
                <span className="flex shrink-0 gap-1">
                  {boards.map((b, k) => (
                    <span key={k} className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold text-ink-950" style={{ background: PLAYER_COLORS[k] }} title={`${names[k]} had him at #${b.indexOf(id) + 1}`}>
                      {b.indexOf(id) + 1}
                    </span>
                  ))}
                </span>
              </button>
            </motion.li>
          )
        })}
      </ol>
      <div className="fixed inset-x-0 bottom-4 z-20 mx-auto max-w-md px-4">
        <button onClick={() => onDone(order)} className="w-full rounded-2xl bg-orange-glow py-4 font-display text-xl font-bold text-ink-950 shadow-xl shadow-black/50 active:scale-[0.99]">
          {multi ? 'Reveal scores' : 'Show my result'}
        </button>
      </div>
    </div>
  )
}

// ---- 5. result ---------------------------------------------------------------------------------------------------------------------------------
function Scores({ category, names, boards, sequence, finalIds, onAgain, onNew }) {
  const byId = useMemo(() => new Map(sequence.map((p) => [p.id, p])), [sequence])
  const rows = boards.map((b, i) => ({ i, name: names[i], ...accuracy(b, finalIds), miss: biggestMiss(b, finalIds) })).sort((a, b) => b.percent - a.percent || b.exact - a.exact)
  const multi = boards.length > 1
  const winners = rows.filter((r) => r.percent === rows[0].percent && r.exact === rows[0].exact)
  const worst = rows.reduce((w, r) => (!w || r.miss.diff > w.miss.diff ? r : w), null)
  const miss = worst.miss
  return (
    <div className="mx-auto max-w-md pb-10">
      <p className="text-center text-sm font-semibold text-white/45">{category}</p>
      {multi ? (
        <>
          <div className="mb-6 mt-2 text-center">
            <Crown weight="fill" size={36} className="mx-auto text-amber-glow" />
            <h2 className="mt-1 font-display text-4xl font-extrabold text-white">{winners.length > 1 ? "It's a tie" : rows[0].name}</h2>
            <p className="text-white/55">{winners.length > 1 ? `${winners.map((w) => w.name).join(' & ')} were equally close to the group` : 'had the blind ranking closest to the group'}</p>
          </div>
          <ol className="space-y-2">
            {rows.map((r, k) => (
              <li key={r.i} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
                <span className="w-5 font-display text-xl font-bold text-white/40">{k + 1}</span>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: PLAYER_COLORS[r.i] }} />
                <span className="min-w-0 flex-1 truncate font-semibold text-white">{r.name}</span>
                <span className="text-xs text-white/45">{r.exact} exact</span>
                <span className="w-14 text-right font-display text-2xl font-extrabold text-white">{r.percent}%</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="mb-6 mt-2 text-center">
          <p className="font-display text-7xl font-extrabold text-white">{rows[0].percent}%</p>
          <p className="text-white/55">
            {rows[0].exact === 0 ? 'No rank was spot on' : `${rows[0].exact} of ${finalIds.length} ranks spot on`}
          </p>
        </div>
      )}
      {miss.diff > 0 && (
        <p className="mt-5 rounded-2xl bg-white/[0.05] px-4 py-3 text-center text-sm text-white/70">
          Biggest surprise: {multi ? worst.name : 'you'} put <span className="font-semibold text-white">{byId.get(miss.id).name}</span> at #{miss.placed + 1} - he ended up #{miss.final + 1}.
        </p>
      )}
      <h3 className="mb-2 mt-7 text-xs font-semibold uppercase tracking-wider text-white/40">Final ranking</h3>
      <ol className="space-y-1">
        {finalIds.map((id, i) => (
          <li key={id} className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2 text-sm">
            <span className="w-5 text-center font-display text-lg font-bold text-white/40">{i + 1}</span>
            <Crest p={byId.get(id)} />
            <span className="truncate text-white">{byId.get(id).name}</span>
          </li>
        ))}
      </ol>
      <div className="mt-7 space-y-2">
        <button onClick={onAgain} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-glow py-4 font-display text-xl font-bold text-ink-950 active:scale-[0.99]">
          <Check weight="bold" size={20} /> Play again
        </button>
        <button onClick={onNew} className="w-full rounded-2xl bg-white/10 py-3.5 font-semibold text-white active:scale-[0.99]">
          New topic
        </button>
      </div>
    </div>
  )
}

// ---- the game ------------------------------------------------------------------------------------------------------------------------------
export default function BlindRanking() {
  const [phase, setPhase] = useState('setup') // setup | pass | play | settle | scores
  const [round, setRound] = useState(null) // { category, length, names, pool, sequence }
  const [turn, setTurn] = useState(0)
  const [boards, setBoards] = useState([])
  const [finalIds, setFinalIds] = useState([])
  const [initial, setInitial] = useState([])

  function begin(config) {
    const sequence = drawSequence(config.pool, config.length)
    setRound({ ...config, sequence })
    setBoards([])
    setTurn(0)
    setPhase(config.names.length > 1 ? 'pass' : 'play')
  }
  function finishTurn(board) {
    const all = [...boards, board]
    setBoards(all)
    if (turn + 1 < round.names.length) {
      setTurn(turn + 1)
      setPhase('pass')
    } else {
      setInitial(averageOrder(all, round.sequence))
      setPhase('settle')
    }
  }

  if (phase === 'setup' || !round) return <Setup onStart={begin} />
  if (phase === 'pass') return <PassPhone key={turn} name={round.names[turn]} color={PLAYER_COLORS[turn]} first={turn === 0} onReady={() => setPhase('play')} />
  if (phase === 'play')
    return (
      <Play
        key={turn}
        category={round.category}
        name={round.names[turn]}
        color={PLAYER_COLORS[turn]}
        count={round.names.length}
        sequence={round.sequence}
        length={round.length}
        onFinish={finishTurn}
        onQuit={() => setPhase('setup')}
      />
    )
  if (phase === 'settle')
    return (
      <Settle
        category={round.category}
        names={round.names}
        boards={boards}
        sequence={round.sequence}
        initial={initial}
        onDone={(ids) => {
          setFinalIds(ids)
          setPhase('scores')
        }}
      />
    )
  return (
    <Scores
      category={round.category}
      names={round.names}
      boards={boards}
      sequence={round.sequence}
      finalIds={finalIds}
      onAgain={() => begin({ category: round.category, length: round.length, names: round.names, pool: round.pool })}
      onNew={() => setPhase('setup')}
    />
  )
}
