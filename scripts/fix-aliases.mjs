// The Guess-the-Player reels look clubs up by the display NAME stored inside club_world.json entries ("Sao Paulo"), which can differ from the entry key ("São Paulo").
// clean-data.mjs only took the keys, so those display names were lost. This adds every old display name as an alias of the club its key belongs to.
//   node scripts/fix-aliases.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const B = 'C:/Users/Iman/.claude/Neuer Ordner/data-backup-2026-10-28/topbin-content-data'
const J = (f) => JSON.parse(readFileSync(f, 'utf8'))
const CHAR_MAP = { ł: 'l', ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', đ: 'd', ð: 'd', þ: 'th', ı: 'i', ŋ: 'n' }
const ns = (s) => String(s).toLowerCase().split('').map((c) => CHAR_MAP[c] ?? c).join('').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const clubs = J(`${R}/src/data/clubs.json`)
const idx = new Map()
for (const c of clubs) for (const n of [c.name, ...c.aliases]) idx.set(ns(n), c)
const known = new Set(clubs.flatMap((c) => [c.name, ...c.aliases])) // exact spellings (the reels look clubs up letter by letter: "Sao Paulo" is not "São Paulo")
let added = 0, unmatched = []
for (const file of ['club_world.json', 'club_logos.json', 'club_coords.json']) {
  const old = J(`${B}/${file}`)
  for (const [k, v] of Object.entries(old)) {
    if (k === '_info') continue
    const names = [k]; if (v && typeof v === 'object' && v.name) names.push(v.name)
    const club = idx.get(ns(k))
    for (const n of names) {
      if (known.has(n)) continue
      if (!club) { unmatched.push(n); continue }
      club.aliases = [...new Set([...club.aliases, n])].sort(); idx.set(ns(n), club); known.add(n); added++
    }
  }
}
writeFileSync(`${R}/src/data/clubs.json`, JSON.stringify(clubs, null, 2) + '\n')
console.log('aliases added:', added, '| names without a club:', unmatched.length, unmatched.slice(0, 10).join(', '))
