import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CaretRight, DiceFive, ListNumbers, X } from '@phosphor-icons/react'
import { cleanName } from '../lib/bwIdentity'
import { containsProfanity } from '../lib/profanity'
import {
  COUNTRY_CHOICES,
  DEFAULT_FILTERS,
  LEAGUE_CHOICES,
  PLAYER_COLORS,
  POSITION_OPTIONS,
  VALUE_OPTIONS,
  SUGGESTIONS,
  buildPool,
  filterSummary,
} from '../lib/blindRanking'

const SILHOUETTE = '/assets/silhouettes/striker_1.svg'
const CLUB_PLACEHOLDER = '/assets/clubs/placeholder.svg'
const SETTINGS_KEY = 'topbin-blind-ranking'
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

export function Crest({ p, size = 'h-4 w-4' }) {
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

/** One big tappable row of the start menu (same look as in Bidding War). */
export function ModeButton({ icon, title, subtitle, onClick, primary = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition active:scale-[0.99] ${
        primary ? 'border-orange-glow/60 bg-orange-glow/10 hover:bg-orange-glow/15' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
      }`}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${primary ? 'bg-orange-glow text-ink-950' : 'bg-white/10 text-white'}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block font-display text-lg font-bold text-white">{title}</span>
        <span className="block text-sm text-white/55">{subtitle}</span>
      </span>
    </button>
  )
}

/** iOS style segmented control: one row, the active choice is a sliding pill. */
export function Segmented({ options, value, onChange, label }) {
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

export function Chip({ on, onClick, children }) {
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

export function Sheet({ open, onClose, title, subtitle, tone, children, footer }) {
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
/** The topic, the length and the footballers of a round. variant 'local': also who is playing (one phone); 'room': the host of an online room. */
export function Setup({ onStart, variant = 'local', startLabel = 'Start', startDisabled = false, hint: startHint = null }) {
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
  const setFilter = (patch) => setSettings((s) => ({ ...s, filters: { ...s.filters, ...patch } }))

  function start() {
    const finalTopic = topic || SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)]
    if (variant === 'room') return onStart({ category: finalTopic, length, pool })
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
      {variant === 'local' && (
        <div className="mb-8 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-glow text-ink-950">
            <ListNumbers weight="fill" size={26} />
          </span>
          <h1 className="font-display text-4xl font-extrabold text-white">Blind Ranking</h1>
        </div>
      )}

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
        {variant === 'local' && (
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
        )}
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
        disabled={!enough || badTopic || startDisabled}
        className="mt-5 w-full rounded-2xl bg-orange-glow py-4 font-display text-xl font-bold text-ink-950 transition enabled:hover:brightness-110 enabled:active:scale-[0.99] disabled:opacity-35"
      >
        {startLabel}
      </button>
      {startHint && <p className="mt-2 text-center text-xs text-white/45">{startHint}</p>}
      {!topic && enough && <p className="mt-2 text-center text-xs text-white/35">No topic? We'll pick one for you.</p>}

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Footballers"
        subtitle={!enough ? `${poolText} - need at least ${length}` : pool.length < length * 3 ? `${poolText} - rounds will look alike` : poolText}
        tone={!enough ? 'bad' : pool.length < length * 3 ? 'warn' : ''}
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
        <FilterGroup title="Market value">
          {VALUE_OPTIONS.map((o) => (
            <Chip key={o.id} on={filters.value === o.id} onClick={() => setFilter({ value: o.id })}>
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
export function PassPhone({ name, color, first, onReady }) {
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
/**
 * One player's blind ranking: one footballer at a time. Online, `peers` ([{ name, placed }]) holds the others: the next footballer only appears when
 * everybody has placed the current one (the same footballer for everybody at the same time); `onPlaced(n)` tells the others how far you are.
 */
export function Play({ category, name, color, count, sequence, length, onFinish, onQuit, peers = [], onPlaced }) {
  const [step, setStep] = useState(0)
  const [board, setBoard] = useState(() => Array(length).fill(null))
  const [picked, setPicked] = useState(null)
  const done = step >= length
  const current = sequence[step]
  const waiting = peers.filter((p) => p.placed < step).map((p) => p.name) // the others who have not placed the last footballer yet
  const ready = !done && waiting.length === 0
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  function lock(slot) {
    if (done || !ready || board[slot]) return
    const next = board.map((x, i) => (i === slot ? current.id : x))
    setBoard(next)
    setPicked(null)
    setStep(step + 1)
    onPlaced?.(step + 1)
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
          {!done && !ready && (
            <motion.div
              key="waiting"
              initial={{ y: 30, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.96 }}
              transition={spring}
              className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/[0.04] px-5 text-center"
            >
              <p className="font-display text-2xl font-bold text-white">Waiting for {waiting.join(' & ')}</p>
              <p className="mt-1 text-sm text-white/45">The next footballer appears when everyone has placed this one.</p>
            </motion.div>
          )}
          {!done && ready && (
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
                  <span className="truncate">{current.club}</span>
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
                disabled={!!p || done || !ready}
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
        {picked !== null && ready && (
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

// ---- result: everybody's ranking side by side. No points and no winner - the friends argue about it ------------------------------------------------
export function Rankings({ category, names, boards, sequence, myIndex = -1, children }) {
  const [focus, setFocus] = useState(null)
  const byId = useMemo(() => new Map(sequence.map((p) => [p.id, p])), [sequence])
  const multi = boards.length > 1
  const unanimous = (i) => multi && boards.every((b) => b[i] === boards[0][i])
  const anyUnanimous = sequence.some((_, i) => unanimous(i))
  const fit = boards.length <= 2 // one or two columns share the width of the phone, three or four scroll sideways
  return (
    <div className="mx-auto max-w-md pb-10">
      <p className="text-center text-sm font-semibold text-white/45">Blind Ranking</p>
      <h2 className="mt-1 text-center font-display text-3xl font-extrabold leading-tight text-white">{category}</h2>
      <p className="mb-5 mt-2 text-center text-white/55">{multi ? 'Compare the rankings - and argue it out.' : 'Your blind ranking.'}</p>
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className={`mx-auto grid gap-1.5 ${fit ? 'w-full' : 'w-max'}`} style={{ gridTemplateColumns: `2rem repeat(${boards.length}, ${fit ? 'minmax(0, 1fr)' : '9.5rem'})` }}>
          <span />
          {boards.map((_, k) => (
            <span key={k} className="flex items-center gap-1.5 truncate px-1 pb-1 text-sm font-semibold text-white">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PLAYER_COLORS[k] }} />
              <span className="truncate">{k === myIndex ? 'You' : names[k]}</span>
            </span>
          ))}
          {sequence.map((_, i) => (
            <Fragment key={i}>
              <span className="flex items-center justify-center gap-0.5 font-display text-lg font-bold text-white/40">
                {i + 1}
                {unanimous(i) && <span className="h-1.5 w-1.5 rounded-full bg-orange-glow" title="Everyone agreed" />}
              </span>
              {boards.map((b, k) => {
                const p = byId.get(b[i])
                const on = focus === b[i]
                return (
                  <button
                    key={k}
                    onClick={() => setFocus(on ? null : b[i])}
                    className={`flex h-12 min-w-0 items-center gap-2 rounded-xl border px-2.5 text-left text-sm transition ${on ? 'border-orange-glow bg-orange-glow/20' : 'border-transparent bg-white/10'}`}
                  >
                    <Crest p={p} size="h-4 w-4 shrink-0" />
                    <span className="line-clamp-2 break-words font-semibold leading-tight text-white">{p.name}</span>
                  </button>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
      {multi && (
        <p className="mt-3 text-center text-xs text-white/35">
          Tap a footballer to see where everyone put him.{anyUnanimous && <span className="text-orange-glow"> ● Everyone agreed.</span>}
        </p>
      )}
      {children}
    </div>
  )
}
