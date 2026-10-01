import players from '../data/players.json'

// players.json marks a retired player's last club with a "(retired)" suffix
// (e.g. "Real Madrid (retired)") so the same real-world club can appear under
// two different strings - strip that back out so the search pool has one
// canonical name per club instead of near-duplicates.
function canonicalizeClub(name) {
  return name.replace(/\s*\(retired\)\s*$/i, '').trim()
}

export const CLUB_NAMES = [...new Set(players.map((p) => p.club).filter(Boolean).map(canonicalizeClub))].sort()
