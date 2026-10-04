// Guest-mode record fallback (6.1): no account -> the best streak only ever lives
// in this browser, never reaches Supabase/leaderboards. New key (was
// 'topbin_guest_highscores' while results were point scores) so old point values
// aren't mistaken for streaks.
const KEY = 'topbin_guest_streaks'

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

export function getLocalHighscore(gameType) {
  return readAll()[gameType] ?? 0
}

export function setLocalHighscoreIfBetter(gameType, score) {
  const all = readAll()
  const isNewBest = score > (all[gameType] ?? 0)
  if (isNewBest) {
    all[gameType] = score
    try {
      localStorage.setItem(KEY, JSON.stringify(all))
    } catch {
      // ignore (private mode / storage disabled)
    }
  }
  return isNewBest
}
