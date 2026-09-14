import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function GameCard({ to, name, tagline, badge, icon, ranked }) {
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
            className={`absolute top-4 right-4 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              ranked ? 'bg-amber-glow/20 text-amber-glow' : 'bg-white/10 text-white/60'
            }`}
          >
            {ranked ? '🏆 ' : ''}
            {badge}
          </span>
        )}
        <div>
          <div className="text-3xl mb-3" aria-hidden="true">{icon}</div>
          <h3 className="font-display text-xl font-semibold text-white">{name}</h3>
          <p className="mt-1 text-sm text-white/60">{tagline}</p>
        </div>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-orange-glow">
          Play now →
        </span>
      </Link>
    </motion.div>
  )
}
