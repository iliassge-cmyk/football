import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { todayCET } from './challengeApi'
import { getMyRankedAttempt } from './dailyChallenge'
import { getMyRankedMinefieldAttempt } from './minefieldChallenge'
import { effectiveCurrentStreak, getStreak, isPendingBreakActive } from './streaks'

const GAMES = {
  daily_top10: getMyRankedAttempt,
  minefield: getMyRankedMinefieldAttempt,
}

/**
 * For the signed-in user: per ranked game the current streak and whether today's ranked challenge was already played.
 * Returns { daily_top10: { streak, playedToday, atRisk }, minefield: { ... } }, or null while loading / for guests / on errors
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
        return [game, { streak: effectiveCurrentStreak(streakRow), playedToday: !!attempt, atRisk: isPendingBreakActive(streakRow.pending_break_at) }]
      })
    )
      .then((entries) => {
        if (!cancelled) setResult({ userId: user.id, value: Object.fromEntries(entries) })
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
