import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function GameCard({ to, name, tagline, badge, icon }) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Link
        to={to}
        className="glass-card relative flex h-full flex-col justify-between rounded-2xl p-5 shadow-lg shadow-black/20 hover:border-emerald-glow/40 transition-colors"
      >
        {badge && (
          <span className="absolute top-4 right-4 rounded-full bg-amber-glow/15 px-2.5 py-1 text-[11px] font-semibold text-amber-glow">
            {badge}
          </span>
        )}
        <div>
          <div className="text-3xl mb-3" aria-hidden="true">{icon}</div>
          <h3 className="font-display text-xl font-semibold text-white">{name}</h3>
          <p className="mt-1 text-sm text-white/60">{tagline}</p>
        </div>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-glow">
          Play now →
        </span>
      </Link>
    </motion.div>
  )
}
