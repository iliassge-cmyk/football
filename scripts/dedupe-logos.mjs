// Identical logo images under different file names: keep one, point every reference to it, move the others to a backup folder.
//   node scripts/dedupe-logos.mjs [--dry]
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const R = path.resolve(here, '..')
const DIR = `${R}/marketing/clublogos2`
const BACKUP = 'C:/Users/Iman/.claude/Neuer Ordner/data-backup-2026-10-28/clublogos2-removed'
const DRY = process.argv.includes('--dry')
const J = (f) => JSON.parse(readFileSync(f, 'utf8'))
const slug = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const clubs = J(`${R}/src/data/clubs.json`)
const aliases = J(`${DIR}/aliases.json`)
const meta = J(`${DIR}/meta.json`)
const files = readdirSync(DIR).filter((f) => f.endsWith('.png'))
const groups = new Map()
for (const f of files) { const h = createHash('md5').update(readFileSync(path.join(DIR, f))).digest('hex'); if (!groups.has(h)) groups.set(h, []); groups.get(h).push(f.replace(/\.png$/, '')) }
const remap = {}
for (const [, keys] of groups) {
  if (keys.length < 2) continue
  // keeper: the key that the master table already uses for the club, else the one equal to the slug of the canonical name, else the shortest
  const used = (k) => clubs.filter((c) => c.logo === k).length
  const bySlug = (k) => clubs.some((c) => slug(c.name) === k)
  const keeper = [...keys].sort((a, b) => used(b) - used(a) || Number(bySlug(b)) - Number(bySlug(a)) || a.length - b.length)[0]
  for (const k of keys) if (k !== keeper) remap[k] = keeper
}
console.log('duplicates:', Object.entries(remap).map(([a, b]) => `${a} -> ${b}`).join(' ; '))
let changed = 0
for (const c of clubs) if (c.logo && remap[c.logo]) { c.logo = remap[c.logo]; changed++ }
for (const [name, k] of Object.entries(aliases)) if (remap[k]) { aliases[name] = remap[k]; changed++ }
for (const k of Object.keys(remap)) delete meta[k]
console.log('references changed:', changed, '| files to remove:', Object.keys(remap).length)
if (!DRY) {
  mkdirSync(BACKUP, { recursive: true })
  for (const k of Object.keys(remap)) if (existsSync(`${DIR}/${k}.png`)) renameSync(`${DIR}/${k}.png`, `${BACKUP}/${k}.png`)
  writeFileSync(`${R}/src/data/clubs.json`, JSON.stringify(clubs, null, 2) + '\n')
  writeFileSync(`${DIR}/aliases.json`, JSON.stringify(aliases, null, 2) + '\n')
  writeFileSync(`${DIR}/meta.json`, JSON.stringify(meta, null, 2) + '\n')
  console.log('done')
} else console.log('(dry run)')
