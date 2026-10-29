// Quiz names -> the full player name as written in players.json ("Messi" -> "Lionel Messi"), so photos, values and statistics can be found by name.
//   node scripts/normalize-quiz-names.mjs [--dry]
// Only a short name that matches exactly ONE player (by last name) is replaced. Exceptions below: other people with the same last name, or too ambiguous.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DRY = process.argv.includes('--dry')
const J = (f) => JSON.parse(readFileSync(f, 'utf8'))
const CHAR_MAP = { ł: 'l', ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', đ: 'd', ð: 'd', þ: 'th', ı: 'i', ŋ: 'n' }
const norm = (s) => String(s).toLowerCase().split('').map((c) => CHAR_MAP[c] ?? c).join('').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const SKIP = new Set(['Enrico Chiesa', 'Paul Robinson', 'Les Ferdinand', 'Benítez', 'Tony Adams', 'Simeone', 'Bellingham', 'Valencia', 'Pepe'].map(norm)) // other people / ambiguous
const FORCE = { [norm('Ibrahimović')]: 'Zlatan Ibrahimović' }

const players = J(`${R}/src/data/players.json`)
const exact = new Set(players.map((p) => norm(p.name)))
const byLast = new Map(); for (const p of players) { const k = norm(p.name).split(' ').at(-1); if (!byLast.has(k)) byLast.set(k, []); byLast.get(k).push(p) }
function full(n) {
  const k = norm(n)
  if (exact.has(k) || SKIP.has(k)) return null
  if (FORCE[k]) return FORCE[k]
  const c = byLast.get(k) ?? byLast.get(k.split(' ').at(-1)) ?? []
  return c.length === 1 ? c[0].name : null
}
const report = { replaced: 0, names: new Set(), duplicatesCreated: [] }
for (const file of ['minefield_categories', 'minefield_daily']) {
  const data = J(`${R}/src/data/${file}.json`)
  for (const q of data) {
    for (const t of q.tiles) { const f = full(t.name); if (f) { report.replaced++; report.names.add(`${t.name} -> ${f}`); t.name = f } }
    const seen = new Set()
    for (const t of q.tiles) { const k = norm(t.name); if (seen.has(k)) report.duplicatesCreated.push(`${file}: ${q.date ?? q.id}: ${t.name}`); seen.add(k) }
  }
  if (!DRY) writeFileSync(`${R}/src/data/${file}.json`, JSON.stringify(data, null, 1) + '\n') // these two files use a one-space indent
}
console.log(`replaced ${report.replaced} tile names (${report.names.size} different)`, '| quizzes where the same person is now twice:', report.duplicatesCreated.length)
for (const d of report.duplicatesCreated) console.log('  ', d)
console.log(DRY ? '(dry run)' : 'written')
