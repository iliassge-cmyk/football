import { supabase } from './supabaseClient'

// How many days (including today) are selectable in the day-picker for both
// dated ranked modes (Daily Top 10 and Minefield).
export const ARCHIVE_DAYS = 16

export function todayUTC() {
  return new Date().toISOString().slice(0, 10)
}

export function daysAgoUTC(n) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** Last ARCHIVE_DAYS calendar dates (today first, oldest last), as ISO strings. */
export function lastNDays(n = ARCHIVE_DAYS) {
  return Array.from({ length: n }, (_, i) => daysAgoUTC(i))
}

/**
 * Builds the read/write API shared by Daily Top 10 and Minefield: both are a
 * dated content table (RLS hides future rows, see 7.9) plus a "ranked once
 * per day, server-computed is_ranked/points" attempts table (see 6.5).
 * `buildAttemptRow(userId, payload)` maps the game-specific submit payload
 * into an insert row for `attemptsTable`.
 */
export function createChallengeApi({ challengeTable, challengeSelect, attemptsTable, buildAttemptRow }) {
  async function getToday() {
    if (!supabase) return null
    const { data, error } = await supabase.from(challengeTable).select(challengeSelect).eq('date', todayUTC()).maybeSingle()
    if (error) throw error
    return data
  }

  async function getForDate(date) {
    if (!supabase) return null
    const cutoff = daysAgoUTC(ARCHIVE_DAYS - 1)
    if (date < cutoff || date > todayUTC()) return null
    const { data, error } = await supabase.from(challengeTable).select(challengeSelect).eq('date', date).maybeSingle()
    if (error) throw error
    return data
  }

  /** Which of the last ARCHIVE_DAYS actually have content (for greying out the day-picker). */
  async function getAvailableDates() {
    if (!supabase) return []
    const cutoff = daysAgoUTC(ARCHIVE_DAYS - 1)
    const { data, error } = await supabase.from(challengeTable).select('date').gte('date', cutoff).lte('date', todayUTC())
    if (error) throw error
    return (data ?? []).map((row) => row.date)
  }

  /** Has the current user already used their one ranked shot at `date`? */
  async function getMyRankedAttempt(date) {
    if (!supabase) return null
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from(attemptsTable)
      .select('*')
      .eq('user_id', user.id)
      .eq('challenge_date', date)
      .eq('is_ranked', true)
      .maybeSingle()
    if (error) throw error
    return data
  }

  /**
   * Submits a finished attempt. `is_ranked`/`points_earned` are never sent —
   * a Postgres trigger derives them from challenge_date vs. the server
   * clock, so a manipulated client clock can't fake a ranked win (7.9).
   */
  async function submitAttempt(payload) {
    if (!supabase) return null
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null // guests never write to the DB (7.2)

    const { data, error } = await supabase
      .from(attemptsTable)
      .insert(buildAttemptRow(user.id, payload))
      .select()
      .single()
    if (error) throw error
    return data
  }

  return { getToday, getForDate, getAvailableDates, getMyRankedAttempt, submitAttempt }
}
