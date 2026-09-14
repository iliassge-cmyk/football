const HISTORY_SIZE = 15

/**
 * Picks a random item from `pool` that isn't one of the last HISTORY_SIZE ids
 * shown (per gameKey), so players don't see the same card/category on
 * back-to-back rounds. Falls back to the full pool if everything has been
 * seen recently (small datasets).
 */
export function pickWithoutRepeat(pool, gameKey, getId = (item) => item.id) {
  if (!pool.length) return null
  const historyKey = `topxi_history_${gameKey}`
  let history = []
  try {
    history = JSON.parse(sessionStorage.getItem(historyKey) || '[]')
  } catch {
    history = []
  }

  let candidates = pool.filter((item) => !history.includes(getId(item)))
  if (candidates.length === 0) candidates = pool

  const choice = candidates[Math.floor(Math.random() * candidates.length)]

  const nextHistory = [getId(choice), ...history].slice(0, HISTORY_SIZE)
  try {
    sessionStorage.setItem(historyKey, JSON.stringify(nextHistory))
  } catch {
    // sessionStorage unavailable (private mode etc.) — anti-repeat is best-effort
  }

  return choice
}

export function pickPairWithoutRepeat(pool, gameKey, getId = (item) => item.id) {
  const first = pickWithoutRepeat(pool, gameKey, getId)
  if (!first) return [null, null]
  const rest = pool.filter((item) => getId(item) !== getId(first))
  const second = rest.length
    ? rest[Math.floor(Math.random() * rest.length)]
    : first
  return [first, second]
}
