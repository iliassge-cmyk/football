import { createChallengeApi } from './challengeApi'

const api = createChallengeApi({
  challengeTable: 'daily_challenges',
  challengeSelect: 'date, title, entries',
  attemptsTable: 'daily_attempts',
  buildAttemptRow: (userId, { challengeDate, livesRemaining, foundCount, completed }) => ({
    user_id: userId,
    challenge_date: challengeDate,
    lives_remaining: livesRemaining,
    found_count: foundCount,
    completed,
  }),
})

export const getTodayChallenge = api.getToday
export const getChallengeForDate = api.getForDate
export const getDailyAvailableDates = api.getAvailableDates
export const getMyRankedAttempt = api.getMyRankedAttempt

export async function submitDailyAttempt({ challengeDate, livesRemaining, foundCount, completed }) {
  return api.submitAttempt({ challengeDate, livesRemaining, foundCount, completed })
}
