import { Link } from 'react-router-dom'
import { lastNDays, todayUTC } from '../lib/challengeApi'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function shortLabel(dateStr) {
  const [, month, day] = dateStr.split('-').map(Number)
  return `${MONTHS[month - 1]} ${day}`
}

/**
 * Shared day-picker for the two dated ranked modes (Daily Top 10, Minefield):
 * last 16 days, today first, greyed out when there's no challenge for that
 * day yet. Only playing *today's* card, on today, is ranked — everything
 * else here is unranked practice.
 */
export default function DayPicker({ basePath, activeDate, availableDates }) {
  const days = lastNDays()
  const today = todayUTC()
  const available = new Set(availableDates)

  return (
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {days.map((date) => {
        const isToday = date === today
        const isActive = activeDate ? date === activeDate : isToday
        const hasChallenge = available.has(date)
        const to = isToday ? basePath : `${basePath}/${date}`

        const base = 'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors'
        if (!hasChallenge) {
          return (
            <span
              key={date}
              className={`${base} border-white/5 bg-white/[0.02] text-white/25 cursor-not-allowed`}
              title="No challenge yet"
            >
              {isToday ? 'Today' : shortLabel(date)}
            </span>
          )
        }

        return (
          <Link
            key={date}
            to={to}
            className={`${base} ${
              isActive
                ? 'border-orange-glow bg-orange-glow/20 text-white'
                : 'border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/10'
            }`}
          >
            {isToday ? 'Today · ranked' : shortLabel(date)}
          </Link>
        )
      })}
    </div>
  )
}
