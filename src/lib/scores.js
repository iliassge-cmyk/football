import { supabase } from './supabaseClient'
import { getLocalHighscore, setLocalHighscoreIfBetter } from './localScores'

/**
 * Submits a finished run's streak (how many in a row). Signed-in users write to Supabase
 * (RLS: insert-own-only, see supabase/schema.sql); guests only ever touch
 * localStorage (6.1 / 7.2 - no DB access for guests at all).
 *
 * `score` is kept in the row (same number) because that column is NOT NULL; the leaderboards read `streak`.
 */
export async function submitScore(gameType, streak) {
  if (!supabase) {
    return { isNewBest: setLocalHighscoreIfBetter(gameType, streak), guest: true }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { isNewBest: setLocalHighscoreIfBetter(gameType, streak), guest: true }
  }

  const { error } = await supabase.from('highscores').insert({ user_id: user.id, game_type: gameType, score: streak, streak })
  if (error) throw error

  const { data: best } = await supabase
    .from('highscores')
    .select('streak')
    .eq('user_id', user.id)
    .eq('game_type', gameType)
    .not('streak', 'is', null)
    .order('streak', { ascending: false })
    .limit(1)
    .maybeSingle()

  return { isNewBest: (best?.streak ?? 0) <= streak, guest: false }
}

export async function getMyHighscore(gameType) {
  if (!supabase) return getLocalHighscore(gameType)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return getLocalHighscore(gameType)

  const { data } = await supabase
    .from('highscores')
    .select('streak')
    .eq('user_id', user.id)
    .eq('game_type', gameType)
    .not('streak', 'is', null)
    .order('streak', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.streak ?? 0
}
