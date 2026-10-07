import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, Flame, Trophy, Warning } from '@phosphor-icons/react'

/** status (signed-in users, ranked games only): { streak, playedToday, atRisk } */
export default function GameCard({ to, name, tagline, badge, icon, ranked, status }) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Link
        to={to}
        className={`glass-card relative flex h-full flex-col justify-between rounded-2xl p-5 shadow-lg shadow-black/20 transition-colors ${
          ranked ? 'border-amber-glow/40 hover:border-amber-glow/70' : 'hover:border-orange-glow/40'
        }`}
      >
        {badge && (
          <span
            className={`absolute top-4 right-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              ranked ? 'bg-amber-glow/20 text-amber-glow' : 'bg-white/10 text-white/60'
            }`}
          >
            {ranked && <Trophy weight="fill" size={12} />}
            {badge}
          </span>
        )}
        <div>
          <div className="text-3xl mb-3 text-orange-glow" aria-hidden="true">{icon}</div>
          <h3 className="font-display text-xl font-semibold text-white">{name}</h3>
          <p className="mt-1 text-sm text-white/60">{tagline}</p>
        </div>
        {status && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
                status.streak > 0 ? 'bg-orange-glow/15 text-orange-glow' : 'bg-white/10 text-white/50'
              }`}
            >
              <Flame weight="fill" size={13} />
              {status.streak > 0 ? `${status.streak}-day streak` : 'No streak yet'}
            </span>
            {status.playedToday ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-400">
                <CheckCircle weight="fill" size={13} />
                Played today
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-glow/15 px-2.5 py-1 text-amber-glow">Not played yet</span>
            )}
            {status.atRisk && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-red-400">
                <Warning weight="fill" size={13} />
                Streak at risk
              </span>
            )}
          </div>
        )}
        <span className={`${status ? 'mt-3' : 'mt-4'} inline-flex items-center gap-1 text-sm font-medium text-orange-glow`}>
          {status?.playedToday ? 'See your result →' : 'Play now →'}
        </span>
      </Link>
    </motion.div>
  )
}
