// Minefield is deliberately stateless/DB-free (3.7), so "cleared" count is
// tracked only as a local, per-browser, purely informational counter.
const KEY = 'topxi_minefields_cleared'

export function getMinefieldsCleared() {
  return Number(localStorage.getItem(KEY) || 0)
}

export function incrementMinefieldsCleared() {
  const next = getMinefieldsCleared() + 1
  try {
    localStorage.setItem(KEY, String(next))
  } catch {
    // ignore
  }
  return next
}
