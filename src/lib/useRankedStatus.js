import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { todayCET } from './challengeApi'
import { getMyRankedAttempt } from './dailyChallenge'
import { getMyRankedMinefieldAttempt } from './minefieldChallenge'
import { effectiveCurrentStreak, getMyFreezeBalance, getStreak, isPendingBreakActive } from './streaks'

const GAMES = {
  daily_top10: getMyRankedAttempt,
  minefield: getMyRankedMinefieldAttempt,
}

/**
 * For the signed-in user: per ranked game the current streak and whether today's ranked challenge was already played.
 * Returns { daily_top10: { streak, playedToday, atRisk, lost, hoursLeft }, minefield: { ... } }
 * A lost ranked game leaves a "pending break" for 24h. It is only an open risk when there is a streak to save AND a freeze to save it with
 * (atRisk); a streak that is gone for good is shown as lost, and nothing is shown when there was no streak at all., or null while loading / for guests / on errors
 * (the cards then simply show no status).
 */
export function useRankedStatus() {
  const { user } = useAuth()
  const [result, setResult] = useState(null) // { userId, value } - tagged with the user so a stale result is never shown after a log-out/in

  useEffect(() => {
    if (!user) return undefined
    let cancelled = false
    const today = todayCET()
    Promise.all(
      Object.entries(GAMES).map(async ([game, getAttempt]) => {
        const [streakRow, attempt] = await Promise.all([getStreak(user.id, game), getAttempt(today)])
        const pending = isPendingBreakActive(streakRow.pending_break_at) && (streakRow.current_streak ?? 0) > 0
        const hoursLeft = pending ? Math.max(1, Math.ceil((new Date(streakRow.pending_break_at).getTime() + 24 * 3600_000 - Date.now()) / 3600_000)) : 0
        return [game, { streak: effectiveCurrentStreak(streakRow), playedToday: !!attempt, pending, hoursLeft }]
      })
    )
      .then(async (entries) => {
        const freezes = entries.some(([, v]) => v.pending) ? await getMyFreezeBalance().catch(() => 0) : 0
        const value = Object.fromEntries(entries.map(([g, v]) => [g, { ...v, atRisk: v.pending && freezes >= 1, lost: v.pending && freezes < 1 }]))
        if (!cancelled) setResult({ userId: user.id, value })
      })
      .catch(() => {
        /* no status shown */
      })
    return () => {
      cancelled = true
    }
  }, [user])

  return user && result?.userId === user.id ? result.value : null
}
