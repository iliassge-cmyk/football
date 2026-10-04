import { useState } from 'react'
import { Check, Crown, Fire, Lock, Medal, ShieldCheck, Sparkle, Target, Trophy } from '@phosphor-icons/react'
import { TIER_STYLE } from '../lib/badges'

const ICONS = { Crown, Target, Trophy, ShieldCheck, Fire, Sparkle }

export default function Badges({ special, categories }) {
  const anyEarned = special.length > 0 || categories.some((c) => c.tier)
  const [hoveredId, setHoveredId] = useState(null) // preview while the pointer/focus is on a badge
  const [pinnedId, setPinnedId] = useState(null) // stays open after a click/tap (also how touch screens use it)

  const shownId = hoveredId ?? pinnedId
  const shown = categories.find((c) => c.id === shownId) ?? null

  return (
    <div className="glass-card rounded-2xl p-5">
      <h2 className="font-display text-lg font-semibold text-white mb-1">Badges</h2>
      {!anyEarned && <p className="text-xs text-white/40 mb-3">No badges yet - keep playing to earn your first one.</p>}
      <p className="text-xs text-white/40 mb-3">Hover or tap a badge to see how to reach Bronze, Silver, Gold and Platinum.</p>

      {special.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {special.map((b) => {
            const Icon = ICONS[b.icon] ?? Medal
            return (
              <div
                key={b.id}
                title={b.description}
                className="flex items-center gap-2 rounded-xl border border-amber-glow/40 bg-gradient-to-br from-amber-glow/20 to-orange-glow/10 px-3 py-2"
                style={{ boxShadow: '0 0 22px rgba(245,185,66,0.3)' }}
              >
                <Icon weight="fill" size={22} className="text-amber-glow shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">{b.label}</p>
                  <p className="text-[11px] text-white/50 leading-tight">{b.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {categories.map((cat) => {
          const Icon = ICONS[cat.icon] ?? Medal
          const style = cat.tier ? TIER_STYLE[cat.tier] : null
          const active = shownId === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              aria-expanded={active}
              onMouseEnter={() => setHoveredId(cat.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(cat.id)}
              onBlur={() => setHoveredId(null)}
              onClick={() => setPinnedId((id) => (id === cat.id ? null : cat.id))}
              className={`rounded-xl border p-3 text-center transition-colors cursor-pointer ${
                active ? 'border-orange-glow/60 bg-white/[0.07]' : style ? 'border-white/15 bg-white/[0.04]' : 'border-white/5 bg-white/[0.02]'
              }`}
            >
              <div
                className="mx-auto mb-1.5 flex h-11 w-11 items-center justify-center rounded-full"
                style={
                  style
                    ? { backgroundColor: `${style.color}22`, boxShadow: `0 0 16px ${style.glow}` }
                    : undefined
                }
              >
                {style ? (
                  <Icon weight="fill" size={22} style={{ color: style.color }} />
                ) : (
                  <Lock weight="bold" size={18} className="text-white/25" />
                )}
              </div>
              <p className={`text-xs font-semibold leading-tight ${style ? 'text-white' : 'text-white/40'}`}>{cat.label}</p>
              <p className="text-[11px] leading-tight mt-0.5" style={style ? { color: style.color } : undefined}>
                {style ? style.label : 'Locked'}
              </p>
              {cat.nextThreshold != null && (
                <p className="text-[10px] text-white/35 mt-1">
                  {cat.value}/{cat.nextThreshold} to {TIER_STYLE[cat.nextTier].label}
                </p>
              )}
            </button>
          )
        })}
      </div>

      {shown && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4" role="status">
          <p className="font-display text-base font-semibold text-white">{shown.label}</p>
          <p className="text-xs text-white/60 mt-0.5">{shown.description}</p>
          <p className="text-xs text-white/50 mt-2">
            You: <span className="font-semibold text-white">{shown.value}</span> {shown.unit}
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {shown.tiers.map(({ tier, threshold, reached }) => {
              const t = TIER_STYLE[tier]
              return (
                <li
                  key={tier}
                  className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
                  style={{ borderColor: reached ? t.color : 'rgba(255,255,255,0.1)', opacity: reached ? 1 : 0.75 }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${t.color}26`, boxShadow: reached ? `0 0 10px ${t.glow}` : undefined }}
                  >
                    {reached ? <Check weight="bold" size={14} style={{ color: t.color }} /> : <Medal weight="fill" size={14} style={{ color: t.color }} />}
                  </span>
                  <span>
                    <span className="block font-semibold" style={{ color: t.color }}>
                      {t.label}
                    </span>
                    <span className="block text-white/60">
                      {threshold} {shown.unit}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
