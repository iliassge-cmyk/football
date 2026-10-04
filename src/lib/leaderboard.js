import { supabase } from './supabaseClient'

/** The given userId if provided, else the signed-in user's own id. */
export async function resolveUserId(userId) {
  if (userId) return userId
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

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
const DATED_GAMES = ['daily_top10', 'minefield']

// ---------------------------------------------------------------------------
// Duels + Guess the Year: the record is the best run - how many right answers in a row in ONE round.
// Every new round starts at zero, nothing carries over.
// ---------------------------------------------------------------------------
export async function getDuelLeaderboard(gameType, { friendsOnly = false } = {}) {
  if (!supabase || !RANKED_DUEL_GAMES.includes(gameType)) return []

  let query = supabase
    .from('best_highscores')
    .select('user_id, streak, profiles(username)')
    .eq('game_type', gameType)
    .order('streak', { ascending: false })
    .limit(100)

  if (friendsOnly) {
    const ids = await myFriendIds()
    if (ids.length === 0) return []
    query = query.in('user_id', ids)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row, i) => ({ rank: i + 1, userId: row.user_id, username: row.profiles?.username, streak: row.streak }))
}

export async function getMyDuelRank(gameType, userId) {
  if (!supabase) return null
  const targetId = await resolveUserId(userId)
  if (!targetId) return null

  const { data: all, error } = await supabase
    .from('best_highscores')
    .select('user_id, streak')
    .eq('game_type', gameType)
    .order('streak', { ascending: false })
  if (error) throw error

  const idx = (all ?? []).findIndex((r) => r.user_id === targetId)
  if (idx === -1) return null

  return { rank: idx + 1, of: all.length, streak: all[idx].streak }
}

// ---------------------------------------------------------------------------
// Ranked games (Daily Top 10, Minefield): the streak is days in a row, kept in streak_state
// (see supabase/schema.sql). `sortBy` = 'current' | 'longest'.
// ---------------------------------------------------------------------------
const DAY_MS = 24 * 60 * 60 * 1000

/** A pending break older than 24h with no freeze spent means the streak is gone (the DB only resets it lazily). */
function effectiveRow(row) {
  const expired = row.pending_break_at && new Date(row.pending_break_at).getTime() + DAY_MS <= Date.now()
  return {
    userId: row.user_id,
    username: row.profiles?.username,
    currentStreak: expired ? 0 : row.current_streak ?? 0,
    perfectCount: expired ? 0 : row.perfect_count ?? 0,
    longestStreak: row.longest_streak ?? 0,
  }
}

async function loadStreakRows(game, userIds) {
  let query = supabase
    .from('streak_state')
    .select('user_id, current_streak, longest_streak, perfect_count, pending_break_at, profiles(username)')
    .eq('game', game)
    .limit(1000)
  if (userIds) query = query.in('user_id', userIds)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(effectiveRow)
}

function rankStreakRows(rows, sortBy) {
  const [first, second] = sortBy === 'longest' ? ['longestStreak', 'currentStreak'] : ['currentStreak', 'longestStreak']
  return rows
    .filter((r) => r[first] > 0)
    .sort((a, b) => b[first] - a[first] || b[second] - a[second])
    .map((r, i) => ({ rank: i + 1, ...r }))
}

export async function getStreakLeaderboard(game, { friendsOnly = false, sortBy = 'current' } = {}) {
  if (!supabase || !DATED_GAMES.includes(game)) return []

  let userIds = null
  if (friendsOnly) {
    userIds = await myFriendIds()
    if (userIds.length === 0) return []
  }

  const rows = rankStreakRows(await loadStreakRows(game, userIds), sortBy)
  return rows.slice(0, 100)
}

export async function getMyStreakRank(game, userId, sortBy = 'current') {
  if (!supabase || !DATED_GAMES.includes(game)) return null
  const targetId = await resolveUserId(userId)
  if (!targetId) return null

  const ranked = rankStreakRows(await loadStreakRows(game), sortBy)
  const mine = ranked.find((r) => r.userId === targetId)
  if (!mine) return null
  return { rank: mine.rank, of: ranked.length }
}
