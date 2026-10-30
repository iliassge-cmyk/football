import { Trophy } from '@phosphor-icons/react'
import { Crest } from './BlindParts'
import { ACTIVE_CATEGORIES, TEAM_SIZE, standings } from '../lib/hitTheNumber'
import { PLAYER_COLORS } from '../lib/blindRanking'
import { normalizeSearch } from '../lib/textNormalize'

export const catOf = (id) => ACTIVE_CATEGORIES.find((c) => c.id === id)
export const fmt = (n, unit) => (unit === '€m' ? `€${n}m` : `${n}`)

/**
 * The draft screen of Hit the Number (one phone and online): the target, whose turn it is, the search and the teams so far.
 * `teams` is a list of footballer lists (one per seat); `canPick` is false while somebody else is picking (online).
 */
export function DraftView({ cat, target, teams, names, activeSeat, canPick, onPick, query, setQuery, banner }) {
  const taken = new Set(teams.flat().map((p) => p.id))
  const q = normalizeSearch(query)
  const matches = !canPick || q.length < 2 ? [] : cat.pool
    .filter((p) => !taken.has(p.id) && normalizeSearch(p.name).includes(q))
    .sort((a, b) => Number(normalizeSearch(b.name).startsWith(q)) - Number(normalizeSearch(a.name).startsWith(q)) || a.name.localeCompare(b.name))
    .slice(0, 6)
  return (
    <div className="mx-auto max-w-md pb-24">
      <div className="mb-4 rounded-3xl border border-white/15 bg-ink-800/95 px-5 py-4 text-center shadow-xl shadow-black/40">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Target · {cat.label}</p>
        <p className="font-display text-6xl font-extrabold leading-none text-white">{fmt(target, cat.unit)}</p>
        <p className="mt-2 text-sm text-white/55">Pick {TEAM_SIZE} footballers that add up to it. Going over is fine.</p>
      </div>

      <div className="mb-3 flex items-center justify-center gap-2 rounded-2xl px-4 py-2 font-display text-xl font-bold text-ink-950" style={{ background: PLAYER_COLORS[activeSeat] }}>
        {banner ?? `${names[activeSeat]} picks`} · {teams[activeSeat].length + 1} / {TEAM_SIZE}
      </div>

      {canPick ? (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a footballer ..."
          autoComplete="off"
          className="mb-2 w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 focus:border-orange-glow focus:outline-none"
        />
      ) : (
        <p className="mb-3 rounded-xl border border-dashed border-white/15 px-4 py-3 text-center text-sm text-white/50">Waiting for {names[activeSeat]} ...</p>
      )}
      {matches.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onPick(p)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-left transition hover:bg-white/10 active:bg-orange-glow/15"
              >
                <Crest p={p} size="h-5 w-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-white">{p.name}</span>
                  <span className="block truncate text-xs text-white/45">{p.club} · {p.position}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {canPick && q.length >= 2 && matches.length === 0 && <p className="mb-3 px-1 text-sm text-white/40">Nobody found - or he is already taken.</p>}

      <div className={`grid gap-2 ${teams.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {teams.map((t, i) => (
          <div key={i} className={`rounded-2xl border p-3 ${i === activeSeat ? 'border-white/30 bg-white/[0.07]' : 'border-white/10 bg-white/[0.03]'}`}>
            <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-white">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLAYER_COLORS[i] }} />
              <span className="truncate">{names[i]}</span>
            </p>
            <ol className="space-y-1">
              {Array.from({ length: TEAM_SIZE }, (_, k) => (
                <li key={k} className="flex h-7 items-center gap-2 text-sm text-white/80">
                  <span className="w-4 text-center text-xs text-white/35">{k + 1}</span>
                  {t[k] ? <><Crest p={t[k]} size="h-4 w-4 shrink-0" /><span className="truncate">{t[k].name}</span></> : <span className="text-white/20">-</span>}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

    </div>
  )
}

/** All numbers revealed: every team with its values, the sum and the distance to the target; the closest wins. `children` are the buttons below. */
export function ResultView({ cat, target, teams, names, children }) {
  const rows = standings(teams, target)
  const best = Math.min(...rows.map((r) => r.diff))
  const count = teams.length
  return (
    <div className="mx-auto max-w-md pb-10">
      <p className="text-center text-sm font-semibold text-white/45">Target · {cat.label}</p>
      <p className="text-center font-display text-6xl font-extrabold text-white">{fmt(target, cat.unit)}</p>
      <p className="mb-5 mt-2 text-center text-white/60">
        {count === 1
          ? best === 0 ? 'Bullseye - exactly on the number!' : `You are ${fmt(best, cat.unit)} away.`
          : rows.filter((r) => r.diff === best).length > 1 ? 'A tie - closest sum shared.' : `${names[rows.find((r) => r.diff === best).index]} wins${best === 0 ? ' with a bullseye' : ''}!`}
      </p>
      <div className={`grid gap-3 ${count > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {[...rows].sort((a, b) => a.diff - b.diff).map((r) => {
          const win = r.diff === best
          return (
            <div key={r.index} className={`rounded-2xl border p-3 ${win ? 'border-orange-glow bg-orange-glow/10' : 'border-white/10 bg-white/[0.04]'}`}>
              <p className="mb-2 flex items-center gap-2 font-semibold text-white">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLAYER_COLORS[r.index] }} />
                <span className="truncate">{names[r.index]}</span>
                {win && count > 1 && <Trophy weight="fill" size={16} className="ml-auto shrink-0 text-orange-glow" />}
              </p>
              <ol className="space-y-1">
                {teams[r.index].map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm text-white/80">
                    <Crest p={p} size="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="font-display font-bold tabular-nums text-white">{fmt(p.stat, cat.unit)}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-2 flex items-baseline justify-between border-t border-white/10 pt-2">
                <span className="font-display text-2xl font-extrabold tabular-nums text-white">{fmt(r.sum, cat.unit)}</span>
                <span className="text-sm text-white/55">{r.diff === 0 ? 'exact!' : `${r.sum > target ? '+' : '-'}${fmt(r.diff, cat.unit)}`}</span>
              </div>
            </div>
          )
        })}
      </div>
      {children}
    </div>
  )
}
