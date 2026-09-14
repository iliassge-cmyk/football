import { createChallengeApi } from './challengeApi'

// Points formula for a ranked, completed Minefield run — our own reasonable
// default (the spec didn't pin exact numbers the way it did for Daily Top 10):
// fewer bombs hit while still clearing all 10 safe tiles scores higher.
export function pointsForBombs(bombsHit) {
  if (bombsHit === 0) return 100
  if (bombsHit === 1) return 85
  if (bombsHit === 2) return 70
  if (bombsHit === 3) return 55
  if (bombsHit === 4) return 40
  return 25 // 5 bombs — the most you can hit and still clear it
}

const api = createChallengeApi({
  challengeTable: 'minefield_challenges',
  challengeSelect: 'date, title, criteria_description, tiles',
  attemptsTable: 'minefield_attempts',
  buildAttemptRow: (userId, { challengeDate, bombsHit, safeFound, completed }) => ({
    user_id: userId,
    challenge_date: challengeDate,
    bombs_hit: bombsHit,
    safe_found: safeFound,
    completed,
  }),
})

export const getTodayMinefield = api.getToday
export const getMinefieldForDate = api.getForDate
export const getMinefieldAvailableDates = api.getAvailableDates
export const getMyRankedMinefieldAttempt = api.getMyRankedAttempt

export async function submitMinefieldAttempt({ challengeDate, bombsHit, safeFound, completed }) {
  return api.submitAttempt({ challengeDate, bombsHit, safeFound, completed })
}
