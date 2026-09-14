import { supabase } from './supabaseClient'
import { getMyGlobalDailyRank, getMyDuelRank } from './leaderboard'
import { getMinefieldsCleared } from './minefieldStats'

const DUEL_GAMES = ['goal_duel', 'market_value_duel', 'assist_duel', 'transfer_duel', 'guess_the_year']

export async function getDashboardStats() {
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [globalDailyRank, duelRanks, dailyRows, highscoreRows, longestStreak, currentStreak] = await Promise.all([
    getMyGlobalDailyRank(),
    Promise.all(DUEL_GAMES.map((g) => getMyDuelRank(g).then((r) => [g, r]))),
    supabase.from('daily_attempts').select('is_ranked, completed').eq('user_id', user.id),
    supabase.from('highscores').select('game_type').eq('user_id', user.id),
    supabase.rpc('get_longest_streak', { target_user: user.id }),
    supabase.rpc('get_current_streak', { target_user: user.id }),
  ])

  const daily = dailyRows.data ?? []
  const rankedDays = daily.filter((d) => d.is_ranked)
  const archiveAttempts = daily.filter((d) => !d.is_ranked)

  const roundCounts = (highscoreRows.data ?? []).reduce((acc, row) => {
    acc[row.game_type] = (acc[row.game_type] ?? 0) + 1
    return acc
  }, {})
  const mostPlayed = Object.entries(roundCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const totalRounds = (highscoreRows.data ?? []).length + daily.length

  return {
    globalDailyRank,
    duelRanks: Object.fromEntries(duelRanks),
    dailyTop10: {
      longestStreak: longestStreak.data ?? 0,
      currentStreak: currentStreak.data ?? 0,
      rankedDaysPlayed: rankedDays.length,
      rankedDaysWon: rankedDays.filter((d) => d.completed).length,
      successRate: rankedDays.length ? Math.round((rankedDays.filter((d) => d.completed).length / rankedDays.length) * 100) : 0,
      archiveAttempts: archiveAttempts.length,
    },
    totalRounds,
    mostPlayed,
    minefieldsCleared: getMinefieldsCleared(),
  }
}
