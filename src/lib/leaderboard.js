import { supabase } from './supabaseClient'

async function myFriendIds() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

  const ids = (data ?? []).map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id))
  return [...ids, user.id]
}

const RANKED_DUEL_GAMES = ['goal_duel', 'market_value_duel', 'assist_duel', 'transfer_duel', 'guess_the_year']

export async function getDuelLeaderboard(gameType, { friendsOnly = false } = {}) {
  if (!supabase || !RANKED_DUEL_GAMES.includes(gameType)) return []

  let query = supabase
    .from('best_highscores')
    .select('user_id, score, profiles(username)')
    .eq('game_type', gameType)
    .order('score', { ascending: false })
    .limit(100)

  if (friendsOnly) {
    const ids = await myFriendIds()
    if (ids.length === 0) return []
    query = query.in('user_id', ids)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row, i) => ({ rank: i + 1, userId: row.user_id, username: row.profiles?.username, score: row.score }))
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10)
}

export async function getDailyTop10Today({ friendsOnly = false } = {}) {
  if (!supabase) return []

  let query = supabase
    .from('daily_attempts')
    .select('user_id, lives_remaining, attempted_at, profiles(username)')
    .eq('challenge_date', todayUTC())
    .eq('is_ranked', true)
    .eq('completed', true)
    .order('lives_remaining', { ascending: false })
    .order('attempted_at', { ascending: true })
    .limit(100)

  if (friendsOnly) {
    const ids = await myFriendIds()
    if (ids.length === 0) return []
    query = query.in('user_id', ids)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row, i) => ({
    rank: i + 1,
    userId: row.user_id,
    username: row.profiles?.username,
    livesRemaining: row.lives_remaining,
  }))
}

export async function getDailyTop10AllTime({ friendsOnly = false } = {}) {
  if (!supabase) return []

  let query = supabase
    .from('daily_top10_alltime')
    .select('user_id, total_points, profiles(username)')
    .order('total_points', { ascending: false })
    .limit(100)

  if (friendsOnly) {
    const ids = await myFriendIds()
    if (ids.length === 0) return []
    query = query.in('user_id', ids)
  }

  const { data, error } = await query
  if (error) throw error

  const withStreaks = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: streak } = await supabase.rpc('get_current_streak', { target_user: row.user_id })
      return {
        userId: row.user_id,
        username: row.profiles?.username,
        totalPoints: row.total_points,
        streak: streak ?? 0,
      }
    }),
  )

  return withStreaks
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((row, i) => ({ rank: i + 1, ...row }))
}

export async function getMinefieldToday({ friendsOnly = false } = {}) {
  if (!supabase) return []

  let query = supabase
    .from('minefield_attempts')
    .select('user_id, bombs_hit, attempted_at, profiles(username)')
    .eq('challenge_date', todayUTC())
    .eq('is_ranked', true)
    .eq('completed', true)
    .order('bombs_hit', { ascending: true })
    .order('attempted_at', { ascending: true })
    .limit(100)

  if (friendsOnly) {
    const ids = await myFriendIds()
    if (ids.length === 0) return []
    query = query.in('user_id', ids)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row, i) => ({
    rank: i + 1,
    userId: row.user_id,
    username: row.profiles?.username,
    bombsHit: row.bombs_hit,
  }))
}

export async function getMinefieldAllTime({ friendsOnly = false } = {}) {
  if (!supabase) return []

  let query = supabase
    .from('minefield_alltime')
    .select('user_id, total_points, profiles(username)')
    .order('total_points', { ascending: false })
    .limit(100)

  if (friendsOnly) {
    const ids = await myFriendIds()
    if (ids.length === 0) return []
    query = query.in('user_id', ids)
  }

  const { data, error } = await query
  if (error) throw error

  const withStreaks = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: streak } = await supabase.rpc('get_current_minefield_streak', { target_user: row.user_id })
      return {
        userId: row.user_id,
        username: row.profiles?.username,
        totalPoints: row.total_points,
        streak: streak ?? 0,
      }
    }),
  )

  return withStreaks
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((row, i) => ({ rank: i + 1, ...row }))
}

export async function getMyMinefieldRank() {
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: all, error } = await supabase
    .from('minefield_alltime')
    .select('user_id, total_points')
    .order('total_points', { ascending: false })
  if (error) throw error

  const idx = (all ?? []).findIndex((r) => r.user_id === user.id)
  if (idx === -1) return null

  return { rank: idx + 1, of: all.length, totalPoints: all[idx].total_points }
}

export async function getMyDuelRank(gameType) {
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: all, error } = await supabase
    .from('best_highscores')
    .select('user_id, score')
    .eq('game_type', gameType)
    .order('score', { ascending: false })
  if (error) throw error

  const idx = (all ?? []).findIndex((r) => r.user_id === user.id)
  if (idx === -1) return null

  return { rank: idx + 1, of: all.length, score: all[idx].score }
}

export async function getMyGlobalDailyRank() {
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: all, error } = await supabase
    .from('daily_top10_alltime')
    .select('user_id, total_points')
    .order('total_points', { ascending: false })
  if (error) throw error

  const idx = (all ?? []).findIndex((r) => r.user_id === user.id)
  if (idx === -1) return null

  return { rank: idx + 1, of: all.length, totalPoints: all[idx].total_points }
}
