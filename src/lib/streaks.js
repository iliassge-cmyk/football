import { supabase } from './supabaseClient'
import { daysAgoCET } from './challengeApi'

/**
 * A game's freeze-aware streak (current/longest/perfect-count, plus any
 * pending break still inside its 24h save window). `game` is 'daily_top10'
 * or 'minefield' - both share the same freeze currency but keep their own
 * streak counter. Works for any userId, not just the signed-in user - same
 * public visibility as streak_state itself, so it also powers friend
 * dashboards and leaderboards.
 */
export async function getStreak(userId, game) {
  if (!supabase || !userId) return { current_streak: 0, longest_streak: 0, perfect_count: 0, pending_break_at: null }
  const { data, error } = await supabase.rpc('get_streak', { p_user_id: userId, p_game: game })
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

/**
 * The streak number to show right now. The stored value is only reset lazily (see supabase/schema.sql), so it also has to
 * count as lost when a whole day was skipped: no pending break and the last counted day is older than yesterday
 * (it stays alive while that day is yesterday or today, because today's challenge can still be played).
 */
export function effectiveCurrentStreak(row) {
  if (!row) return 0
  if (isPendingBreakActive(row.pending_break_at)) return row.current_streak ?? 0
  if (row.pending_break_at) return 0 // 24h window over, nobody saved it
  if (row.last_counted_date && row.last_counted_date < daysAgoCET(1)) return 0
  return row.current_streak ?? 0
}
