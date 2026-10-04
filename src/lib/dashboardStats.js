import { supabase } from './supabaseClient'
import { getMyStreakRank, getMyDuelRank, resolveUserId } from './leaderboard'
import { getStreak, getMyFreezeBalance } from './streaks'

const DUEL_GAMES = ['goal_duel', 'market_value_duel', 'assist_duel', 'transfer_duel', 'guess_the_year']

/** Stats for the given userId, or the signed-in user's own if omitted. */
export async function getDashboardStats(userId) {
  if (!supabase) return null
  const targetId = await resolveUserId(userId)
  if (!targetId) return null

  const [
    dailyRank,
    minefieldRank,
    duelRanks,
    dailyRows,
    minefieldRows,
    highscoreRows,
    dailyStreak,
    minefieldStreak,
    freezeBalance,
  ] = await Promise.all([
    getMyStreakRank('daily_top10', targetId),
    getMyStreakRank('minefield', targetId),
    Promise.all(DUEL_GAMES.map((g) => getMyDuelRank(g, targetId).then((r) => [g, r]))),
    supabase.from('daily_attempts').select('is_ranked, completed').eq('user_id', targetId),
    supabase.from('minefield_attempts').select('is_ranked, completed').eq('user_id', targetId),
    supabase.from('highscores').select('game_type').eq('user_id', targetId),
    getStreak(targetId, 'daily_top10'),
    getStreak(targetId, 'minefield'),
    // Freeze balance is personal, not "this profile's" stat - only fetch it
    // when looking at your own dashboard (userId omitted), never a friend's.
    userId === undefined ? getMyFreezeBalance() : 0,
  ])

  const daily = dailyRows.data ?? []
  const rankedDays = daily.filter((d) => d.is_ranked)
  const dailyPracticeAttempts = daily.filter((d) => !d.is_ranked)

  const minefield = minefieldRows.data ?? []
  const rankedMinefieldDays = minefield.filter((d) => d.is_ranked)
  const minefieldPracticeAttempts = minefield.filter((d) => !d.is_ranked)

  // How often each game was played (every finished run/attempt counts once). Keys are the internal game keys;
  // the Dashboard turns them into display names.
  const roundCounts = (highscoreRows.data ?? []).reduce((acc, row) => {
    acc[row.game_type] = (acc[row.game_type] ?? 0) + 1
    return acc
  }, {})
  if (daily.length) roundCounts.daily_top10 = daily.length
  if (minefield.length) roundCounts.minefield = minefield.length
  const mostPlayed = Object.entries(roundCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const totalRounds = (highscoreRows.data ?? []).length + daily.length + minefield.length

  return {
    dailyRank,
    minefieldRank,
    duelRanks: Object.fromEntries(duelRanks),
    dailyTop10: {
      longestStreak: dailyStreak.longest_streak ?? 0,
      currentStreak: dailyStreak.current_streak ?? 0,
      perfectCount: dailyStreak.perfect_count ?? 0,
      pendingBreakAt: dailyStreak.pending_break_at ?? null,
      rankedDaysPlayed: rankedDays.length,
      rankedDaysWon: rankedDays.filter((d) => d.completed).length,
      successRate: rankedDays.length ? Math.round((rankedDays.filter((d) => d.completed).length / rankedDays.length) * 100) : 0,
      practiceAttempts: dailyPracticeAttempts.length,
    },
    minefield: {
      longestStreak: minefieldStreak.longest_streak ?? 0,
      currentStreak: minefieldStreak.current_streak ?? 0,
      perfectCount: minefieldStreak.perfect_count ?? 0,
      pendingBreakAt: minefieldStreak.pending_break_at ?? null,
      rankedDaysPlayed: rankedMinefieldDays.length,
      rankedDaysWon: rankedMinefieldDays.filter((d) => d.completed).length,
      successRate: rankedMinefieldDays.length
        ? Math.round((rankedMinefieldDays.filter((d) => d.completed).length / rankedMinefieldDays.length) * 100)
        : 0,
      practiceAttempts: minefieldPracticeAttempts.length,
    },
    totalRounds,
    mostPlayed,
    freezeBalance,
  }
}
