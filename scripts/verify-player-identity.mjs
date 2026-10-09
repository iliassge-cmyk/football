// Checks that every player in src/data/players.json really is the person the data sources describe:
// birth date on FotMob (the page the weekly refresh reads) vs birth date in the Footballdatabase export (exports/fbd_all.json).
// A mismatch means the two sources describe different people (namesakes, women's players, wrong search hit).
//
// Raw FotMob answers are cached in exports/fotmob_identity_cache.json (resumable). Output: exports/identity_report.json
// Usage: node scripts/verify-player-identity.mjs [--delay 1000] [--limit 2000]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const val = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d)
const DELAY = Number(val('--delay', '1000'))
const LIMIT = Number(val('--limit', '5000'))
const players = JSON.parse(readFileSync(path.join(here, '../src/data/players.json'), 'utf8'))
const fbd = new Map(JSON.parse(readFileSync(path.join(here, '../exports/fbd_all.json'), 'utf8')).results.map((r) => [r.profile.inGameName, r.profile]))
const cachePath = path.join(here, '../exports/fotmob_identity_cache.json')
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {}
const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' }
const NEXT = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 }

function fbdBirth(s) {
  const m = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(s ?? '')
  return m && MONTHS[m[1].toLowerCase()] ? `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, '0')}-${m[2].padStart(2, '0')}` : null
}
async function fotmob(id) {
  if (cache[id]) return cache[id]
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://www.fotmob.com/players/${id}/x`, { headers: H, signal: AbortSignal.timeout(30_000) })
      if (r.status === 404) return (cache[id] = { id, error: 404 })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const m = (await r.text()).match(NEXT)
      if (!m) return (cache[id] = { id, error: 'no data' })
      const d = JSON.parse(m[1]).props.pageProps.data
      return (cache[id] = { id, name: d.name, birth: d.birthDate?.utcTime?.slice(0, 10) ?? null, team: d.primaryTeam?.teamName ?? null, gender: d.gender ?? null })
    } catch (e) {
      await sleep(3000 * (i + 1))
    }
  }
  return { id, error: 'failed' }
}

const rows = []
let fetched = 0
for (const p of players) {
  const idMatch = /fotmob\.com\/players\/(\d+)/.exec(p.source ?? '')
  const f = fbd.get(p.name)
  const row = { name: p.name, club: p.club, source: p.source, fotmobId: idMatch ? Number(idMatch[1]) : null, fbdBorn: fbdBirth(f?.born), fbdId: f?.fbdId ?? null, fbdPage: f?.pageName ?? null }
  if (row.fotmobId && fetched < LIMIT) {
    const fresh = !cache[row.fotmobId]
    const d = await fotmob(row.fotmobId)
    if (fresh) {
      fetched++
      if (fetched % 50 === 0) {
        writeFileSync(cachePath, JSON.stringify(cache))
        console.log(`${fetched} fetched, ${rows.length} players done`)
      }
      await sleep(DELAY)
    }
    Object.assign(row, { fmName: d.name ?? null, fmBirth: d.birth ?? null, fmTeam: d.team ?? null, fmGender: d.gender ?? null, fmError: d.error ?? null })
  }
  row.status = !row.fotmobId ? 'no-fotmob-id' : row.fmName === undefined && !row.fmError ? 'not-fetched' : row.fmError ? 'fotmob-error' : !row.fbdBorn ? 'no-fbd-birth' : row.fmBirth === row.fbdBorn ? 'match' : row.fmBirth?.slice(0, 4) === row.fbdBorn.slice(0, 4) ? 'year-match' : 'MISMATCH'
  rows.push(row)
}
writeFileSync(cachePath, JSON.stringify(cache))
writeFileSync(path.join(here, '../exports/identity_report.json'), JSON.stringify(rows, null, 1))
const count = rows.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {})
console.log('done:', JSON.stringify(count))
