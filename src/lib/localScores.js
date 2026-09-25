// Guest-mode highscore fallback (6.1): no account -> score only ever lives
// in this browser, never reaches Supabase/leaderboards.
const KEY = 'topbin_guest_highscores'

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
