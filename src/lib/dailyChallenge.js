import { supabase } from './supabaseClient'

const ARCHIVE_DAYS = 15

function todayUTC() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoUTC(n) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/**
 * Fetches today's Daily Top 10 category. Rows for future dates are hidden
 * server-side by RLS (see supabase/schema.sql: daily_challenges_select_available),
 * so a future category never reaches the client/network tab before its day.
 */
export async function getTodayChallenge() {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('daily_challenges')
    .select('date, title, entries')
    .eq('date', todayUTC())
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getChallengeForDate(date) {
  if (!supabase) return null
  const cutoff = daysAgoUTC(ARCHIVE_DAYS)
  if (date < cutoff || date > todayUTC()) return null
  const { data, error } = await supabase
    .from('daily_challenges')
    .select('date, title, entries')
    .eq('date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getArchiveList() {
  if (!supabase) return []
  const cutoff = daysAgoUTC(ARCHIVE_DAYS)
  const { data, error } = await supabase
    .from('daily_challenges')
    .select('date, title')
    .gte('date', cutoff)
    .lt('date', todayUTC())
    .order('date', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Has the current user already used their one ranked shot at `date`? */
export async function getMyRankedAttempt(date) {
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('daily_attempts')
    .select('*')
    .eq('user_id', user.id)
    .eq('challenge_date', date)
    .eq('is_ranked', true)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Submits a finished attempt. `is_ranked` and `points_earned` are NOT sent —
 * they're computed by a Postgres trigger from challenge_date vs. the server
 * clock, so a manipulated client clock can't fake a ranked win (see 7.9).
 */
export async function submitDailyAttempt({ challengeDate, livesRemaining, foundCount, completed }) {
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null // guests never write to the DB (7.2)

  const { data, error } = await supabase
    .from('daily_attempts')
    .insert({
      user_id: user.id,
      challenge_date: challengeDate,
      lives_remaining: livesRemaining,
      found_count: foundCount,
      completed,
    })
    .select()
    .single()
  if (error) throw error
  return data
}
