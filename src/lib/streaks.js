import { supabase } from './supabaseClient'

/**
 * Daily Top 10's freeze-aware streak (current/longest/perfect-count, plus any
 * pending break still inside its 24h save window). Works for any userId, not
 * just the signed-in user - same public visibility as streak_state itself,
 * so it also powers friend dashboards and leaderboards.
 */
export async function getDailyTop10Streak(userId) {
  if (!supabase || !userId) return { current_streak: 0, longest_streak: 0, perfect_count: 0, pending_break_at: null }
  const { data, error } = await supabase.rpc('get_streak', { p_user_id: userId, p_game: 'daily_top10' })
  if (error) throw error
  return data ?? { current_streak: 0, longest_streak: 0, perfect_count: 0, pending_break_at: null }
}

/** The signed-in user's own banked freeze count (private - never shown for other users). */
export async function getMyFreezeBalance() {
  if (!supabase) return 0
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0

  const { data, error } = await supabase.from('streak_freezes').select('balance').eq('user_id', user.id).maybeSingle()
  if (error) throw error
  return data?.balance ?? 0
}

export function isPendingBreakActive(pendingBreakAt) {
  if (!pendingBreakAt) return false
  return new Date(pendingBreakAt).getTime() + 24 * 60 * 60 * 1000 > Date.now()
}

/** Spends one freeze to save the signed-in user's own currently-pending break. */
export async function spendFreeze(game) {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('spend_freeze', { p_game: game })
  if (error) throw error
  return !!data
}
