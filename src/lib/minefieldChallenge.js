import { createChallengeApi } from './challengeApi'

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
