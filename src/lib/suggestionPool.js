/**
 * Names offered in the Daily Top 10 search box for one challenge.
 *
 * Three rules keep the search from giving the answer away:
 *  - the base pool depends on what the answers ARE (players / clubs / managers) and never mixes kinds,
 *  - the challenge's own answers are always included,
 *  - so are its near misses (`also_ran`, places 11+): without them a player who just missed the top 10 would
 *    not show up in the search at all, which would reveal "if you can find him, he is probably an answer".
 *
 * `pools` = { players, clubs, managers } - plain arrays of names (injected so this stays easy to test).
 */
export function buildSuggestionPool(challenge, pools) {
  const type = challenge?.question_type ?? 'player'
  const base = type === 'club' ? pools.clubs : type === 'manager' ? pools.managers : pools.players
  const own = [...(challenge?.entries ?? []), ...(challenge?.also_ran ?? [])].map((e) => e.name)
  return [...new Set([...base, ...own])]
}
