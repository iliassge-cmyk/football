import { supabase } from './supabaseClient'
import { getLocalHighscore, setLocalHighscoreIfBetter } from './localScores'

/**
 * Submits a finished round's score. Signed-in users write to Supabase
 * (RLS: insert-own-only, see supabase/schema.sql); guests only ever touch
 * localStorage (6.1 / 7.2 — no DB access for guests at all).
 */
export async function submitScore(gameType, score) {
  if (!supabase) {
    return { isNewBest: setLocalHighscoreIfBetter(gameType, score), guest: true }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { isNewBest: setLocalHighscoreIfBetter(gameType, score), guest: true }
  }

  const { error } = await supabase.from('highscores').insert({ user_id: user.id, game_type: gameType, score })
  if (error) throw error

  const { data: best } = await supabase
    .from('highscores')
    .select('score')
    .eq('user_id', user.id)
    .eq('game_type', gameType)
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle()

  return { isNewBest: (best?.score ?? 0) <= score, guest: false }
}

export async function getMyHighscore(gameType) {
  if (!supabase) return getLocalHighscore(gameType)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return getLocalHighscore(gameType)

  const { data } = await supabase
    .from('highscores')
    .select('score')
    .eq('user_id', user.id)
    .eq('game_type', gameType)
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.score ?? 0
}
