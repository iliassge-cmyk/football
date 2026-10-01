import { supabase } from './supabaseClient'
import { getMyGlobalDailyRank, getMyMinefieldRank, getMyDuelRank, resolveUserId } from './leaderboard'
import { getDailyTop10Streak, getMyFreezeBalance } from './streaks'

const DUEL_GAMES = ['goal_duel', 'market_value_duel', 'assist_duel', 'transfer_duel', 'guess_the_year']

/** Stats for the given userId, or the signed-in user's own if omitted. */
export async function getDashboardStats(userId) {
  if (!supabase) return null
  const targetId = await resolveUserId(userId)
  if (!targetId) return null

  const [
    globalDailyRank,
    globalMinefieldRank,
    duelRanks,
    dailyRows,
    minefieldRows,
    highscoreRows,
    dailyStreak,
    minefieldLongestStreak,
    minefieldCurrentStreak,
    freezeBalance,
  ] = await Promise.all([
    getMyGlobalDailyRank(targetId),
    getMyMinefieldRank(targetId),
    Promise.all(DUEL_GAMES.map((g) => getMyDuelRank(g, targetId).then((r) => [g, r]))),
    supabase.from('daily_attempts').select('is_ranked, completed').eq('user_id', targetId),
    supabase.from('minefield_attempts').select('is_ranked, completed').eq('user_id', targetId),
    supabase.from('highscores').select('game_type').eq('user_id', targetId),
    getDailyTop10Streak(targetId),
    supabase.rpc('get_longest_minefield_streak', { target_user: targetId }),
    supabase.rpc('get_current_minefield_streak', { target_user: targetId }),
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

  const roundCounts = (highscoreRows.data ?? []).reduce((acc, row) => {
    acc[row.game_type] = (acc[row.game_type] ?? 0) + 1
    return acc
  }, {})
  const mostPlayed = Object.entries(roundCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const totalRounds = (highscoreRows.data ?? []).length + daily.length + minefield.length

  return {
    globalDailyRank,
    globalMinefieldRank,
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
      longestStreak: minefieldLongestStreak.data ?? 0,
      currentStreak: minefieldCurrentStreak.data ?? 0,
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
