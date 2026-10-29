// Merge duplicate clubs in the master table: the second id disappears and becomes an alias of the first; players, transfers and matches follow.
//   node scripts/merge-clubs.mjs
// Also marks national teams (they are in matches.json) with type "national_team" so they are not mistaken for clubs.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const J = (f) => JSON.parse(readFileSync(f, 'utf8'))
const W = (f, d) => writeFileSync(f, JSON.stringify(d, null, 2) + '\n')
const MERGE = [['paris-saint-germain', 'psg'], ['psv-eindhoven', 'psv']] // [keep, drop]
const NATIONAL = ['Belgium', 'England', 'France', 'Germany', 'Italy', 'Netherlands', 'Portugal', 'Spain', 'West Germany', 'Czech Republic', 'Czechoslovakia', 'Iceland', 'Soviet Union', 'Wales', 'Yugoslavia', 'Soccer Aid World XI']

const clubs = J(`${R}/src/data/clubs.json`), players = J(`${R}/src/data/players.json`), transfers = J(`${R}/src/data/transfers.json`), matches = J(`${R}/src/data/matches.json`)
let moved = 0
for (const [keepId, dropId] of MERGE) {
  const keep = clubs.find((c) => c.id === keepId), drop = clubs.find((c) => c.id === dropId)
  if (!keep || !drop) { console.log('skip', keepId, dropId); continue }
  keep.aliases = [...new Set([...keep.aliases, drop.name, ...drop.aliases])].sort()
  keep.logo ??= drop.logo
  if (keep.lon == null && drop.lon != null) { keep.lon = drop.lon; keep.lat = drop.lat }
  clubs.splice(clubs.indexOf(drop), 1)
  for (const p of players) if (p.club_id === dropId) { p.club = keep.name; p.club_id = keepId; moved++ }
  for (const t of transfers) for (const [f, i] of [['from_club', 'from_club_id'], ['to_club', 'to_club_id']]) if (t[i] === dropId) { t[f] = keep.name; t[i] = keepId; moved++ }
  for (const m of matches) for (const [f, i] of [['home_team', 'home_id'], ['away_team', 'away_id']]) if (m[i] === dropId) { m[f] = keep.name; m[i] = keepId; moved++ }
  console.log(`merged "${drop.name}" into "${keep.name}"`)
}
for (const c of clubs) if (NATIONAL.includes(c.name)) c.type = 'national_team'
console.log('references moved:', moved, '| clubs now:', clubs.length, '| national teams marked:', clubs.filter((c) => c.type === 'national_team').length)
W(`${R}/src/data/clubs.json`, clubs); W(`${R}/src/data/players.json`, players); W(`${R}/src/data/transfers.json`, transfers); W(`${R}/src/data/matches.json`, matches)
