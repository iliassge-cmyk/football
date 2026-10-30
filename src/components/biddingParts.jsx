import { Coins } from '@phosphor-icons/react'
import { BUDGET, ROSTER_SIZE } from '../lib/biddingEngine'

/** Slim bar that stays visible while bidding: every team's budget and how many players it has. */
export function TeamsBar({ teams, activeIndex, leaderIndex }) {
  return (
    <div className="sticky top-[61px] z-30 -mx-4 -mt-6 mb-5 border-b border-white/10 bg-ink-950/90 px-4 py-2 backdrop-blur-md">
      <div className="grid grid-flow-col auto-cols-fr gap-1.5 sm:gap-2">
        {teams.map((t, i) => (
          <div
            key={i}
            className={`min-w-0 rounded-lg border px-2 py-1.5 text-left sm:px-2.5 ${
              i === activeIndex ? 'border-orange-glow bg-orange-glow/10' : 'border-white/10 bg-white/[0.03]'
            }`}
          >
            <p className="truncate text-[11px] font-semibold text-white/80">
              {t.name}
              {i === leaderIndex && <span className="ml-1 text-orange-glow">· leading</span>}
            </p>
            <p className="flex items-baseline gap-2">
              <span className="font-display text-lg font-bold text-white">€{t.budget}</span>
              <span className="text-[10px] text-white/40">
                {t.roster.length}/{ROSTER_SIZE}
                <span className="hidden sm:inline"> players</span>
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Every team's current squad (with the price paid) and budget left; the team that acts right now is outlined. */
export function TeamsPanel({ teams, activeIndex }) {
  return (
    <div className="mt-8 grid gap-3 text-left sm:grid-cols-2 lg:mt-0 lg:grid-cols-1">
      {teams.map((t, i) => (
        <div key={i} className={`glass-card rounded-2xl p-4 ${i === activeIndex ? 'ring-1 ring-orange-glow/60' : ''}`}>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="truncate font-display text-base font-bold text-white">{t.name}</h3>
            <span className="shrink-0 text-xs text-white/50">€{t.budget} left</span>
          </div>
          <ul className="space-y-1">
            {Array.from({ length: ROSTER_SIZE }, (_, s) => {
              const p = t.roster[s]
              return p ? (
                <li key={s} className="flex justify-between gap-2 text-sm text-white/80">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-white/40">€{p.paid}</span>
                </li>
              ) : (
                <li key={s} className="text-sm text-white/20">
                  Slot {s + 1} open
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** End screen: side-by-side comparison of the squads (no winner is declared). */
export function BiddingResults({ teams, onAgain, againLabel = 'New Draft', children }) {
  const stats = teams.map((t) => ({
    name: t.name,
    roster: t.roster,
    goals: t.roster.reduce((s, p) => s + (p.career_goals ?? 0), 0),
    assists: t.roster.reduce((s, p) => s + (p.career_assists ?? 0), 0),
    value: t.roster.reduce((s, p) => s + (p.market_value_eur ?? 0), 0),
    spent: BUDGET - t.budget,
  }))
  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="font-display text-3xl font-bold text-white mb-1 text-center">Draft Complete!</h2>
      <p className="text-sm text-white/50 mb-6 text-center">No winner declared - compare and argue it out.</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {stats.map((t) => (
          <div key={t.name} className="glass-card rounded-2xl p-5">
            <h3 className="font-display text-lg font-bold text-white mb-1">{t.name}</h3>
            <p className="text-xs text-white/40 mb-3">€{t.spent}/{BUDGET} spent</p>
            <p className="mb-1 text-right text-[10px] text-white/30">Goals / Assists / Value (€M)</p>
            <ul className="text-sm text-white/70 space-y-1 mb-4">
              {t.roster.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate">{p.name}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-white/40">
                    {p.career_goals ?? 0} / {p.career_assists ?? 0} / {Math.round((p.market_value_eur ?? 0) / 1_000_000)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-3 gap-2 text-center border-t border-white/10 pt-3">
              <div>
                <p className="font-display text-lg font-bold text-orange-glow">{t.goals}</p>
                <p className="text-[10px] text-white/40">Goals</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-orange-glow">{t.assists}</p>
                <p className="text-[10px] text-white/40">Assists</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-orange-glow inline-flex items-center gap-0.5 justify-center">
                  <Coins weight="fill" size={14} />€{Math.round(t.value / 1_000_000)}M
                </p>
                <p className="text-[10px] text-white/40">Value</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {children}
      <button
        onClick={onAgain}
        className="w-full rounded-xl bg-orange-glow px-4 py-3 text-sm font-bold text-ink-950 hover:brightness-110 transition"
      >
        {againLabel}
      </button>
    </div>
  )
}
