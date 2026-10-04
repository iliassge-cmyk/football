// Weekly goalkeeper clean sheets.
//
// Why two sources: FotMob only has deep stats for recent seasons and lists national-team tournaments next to
// club ones, so a pure FotMob career total comes out too low (Courtois: 195 vs. 278 club clean sheets on
// Footballdatabase). So:
//   - history   : per-season club clean sheets from the one-time Footballdatabase export
//                 (data/extended/keeper_baseline.json, built by scripts/build-keeper-baseline.mjs)
//   - live part : the newest two seasons are re-read from FotMob every run, club competitions only;
//                 for those season labels FotMob overrides the stored value
//   career_clean_sheets = sum over seasons of (FotMob value if refreshed this run, else stored value)
//
// Only active goalkeepers are processed (retired ones are never touched, like in refresh-players-data.mjs).
// Result: players.json gets `career_clean_sheets`; the per-season detail goes to data/extended/keeper_stats.json.
//
// Usage:
//   node scripts/refresh-clean-sheets.mjs
//   Options: --only "Name1,Name2"   --dry-run (no files written)
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLAYERS_PATH = path.join(__dirname, '../src/data/players.json')
const BASELINE_PATH = path.join(__dirname, '../data/extended/keeper_baseline.json')
const STATS_PATH = path.join(__dirname, '../data/extended/keeper_stats.json')

const args = process.argv.slice(2)
const argValue = (flag) => (args.indexOf(flag) >= 0 ? args[args.indexOf(flag) + 1] : null)
const DRY = args.includes('--dry-run')
const ONLY = argValue('--only')
const LIVE_SEASONS = 2
const DELAY_MS = 300
const MAX_CONSECUTIVE_ERRORS = 5

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
}
const NEXT_DATA_RE = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
const FOTMOB_ID_FROM_SOURCE_RE = /fotmob\.com\/players\/(\d+)/

// National-team tournaments FotMob lists next to club competitions. Club "World Cup"/"Super Cup" variants stay in.
const NATIONAL_TEAM_RE = /(world cup|euro\b|nations league|copa am[eé]rica|africa cup|asian cup|gold cup|olympic|confederations|friendl|international)/i
const isNationalTeamTournament = (name) => NATIONAL_TEAM_RE.test(name || '') && !/club|champions|europa|conference|super cup|intercontinental/i.test(name || '')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const isGoalkeeper = (p) => /keeper|goalkeeper|\bgk\b/i.test(p.position || '')
const isRetired = (p) => /\(retired\)\s*$/i.test(p.club || '')
const num = (v) => (v != null && /^\d+$/.test(String(v)) ? parseInt(v, 10) : null)
const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const sameName = (a, b) => {
  const ta = fold(a).split(' ').filter(Boolean)
  const tb = fold(b).split(' ').filter(Boolean)
  return ta.length > 0 && tb.length > 0 && (ta.every((t) => tb.includes(t)) || tb.every((t) => ta.includes(t)))
}

async function fotmobSearchPlayerId(name) {
  const url = new URL('https://apigw.fotmob.com/searchapi/suggest')
  url.search = new URLSearchParams({ term: name, lang: 'en', project: 'fotmob-web' }).toString()
  const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) })
  if (!resp.ok) throw new Error(`search HTTP ${resp.status}`)
  const data = await resp.json()
  for (const group of data.squadMemberSuggest || []) {
    for (const option of group.options || []) {
      if (!option.payload?.isCoach) return parseInt(option.payload.id, 10)
    }
  }
  return null
}

async function fotmobProfile(playerId) {
  const resp = await fetch(`https://www.fotmob.com/players/${playerId}`, { headers: HEADERS, signal: AbortSignal.timeout(30_000) })
  if (!resp.ok) throw new Error(`profile HTTP ${resp.status}`)
  const match = (await resp.text()).match(NEXT_DATA_RE)
  if (!match) throw new Error(`no __NEXT_DATA__ for FotMob player ${playerId}`)
  return JSON.parse(match[1]).props.pageProps.data
}

async function fotmobEntryStats(playerId, entryId) {
  const resp = await fetch(`https://www.fotmob.com/api/data/playerStats?playerId=${playerId}&seasonId=${entryId}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(30_000),
  })
  if (!resp.ok) throw new Error(`stats HTTP ${resp.status}`)
  const data = await resp.json()
  return Object.fromEntries((data.statsSection?.items || []).flatMap((g) => g.items || []).map((i) => [i.title, i.statValue]))
}

/** Club clean sheets of the newest LIVE_SEASONS seasons from FotMob: { "2025/2026": { cleanSheets, ... } } */
async function liveSeasons(player, stored) {
  let fotmobId = stored?.fotmobId
  if (!fotmobId) {
    const fromSource = (player.source || '').match(FOTMOB_ID_FROM_SOURCE_RE)
    fotmobId = fromSource ? parseInt(fromSource[1], 10) : await fotmobSearchPlayerId(player.name)
    await sleep(DELAY_MS)
  }
  if (!fotmobId) throw new Error('no FotMob match')

  const raw = await fotmobProfile(fotmobId)
  await sleep(DELAY_MS)
  const position = raw.positionDescription?.primaryPosition?.label ?? ''
  if (!isGoalkeeper({ position })) throw new Error(`FotMob says "${position}" - not a goalkeeper (wrong person?)`)

  const out = {}
  for (const season of (raw.statSeasons || []).slice(0, LIVE_SEASONS)) {
    let cleanSheets = 0
    let goalsAgainst = 0
    let found = false
    for (const tournament of season.tournaments || []) {
      if (!tournament.hasDeepStats || isNationalTeamTournament(tournament.name)) continue
      const stats = await fotmobEntryStats(fotmobId, tournament.entryId)
      await sleep(DELAY_MS)
      if (stats['Clean sheets'] == null && stats['Goals conceded'] == null) continue
      found = true
      cleanSheets += num(stats['Clean sheets']) ?? 0
      goalsAgainst += num(stats['Goals conceded']) ?? 0
    }
    if (found) out[season.seasonName] = { cleanSheets, goalsAgainst }
  }
  return { fotmobId, fotmobName: raw.name, live: out }
}

async function main() {
  if (!existsSync(BASELINE_PATH)) {
    console.error(`Missing ${BASELINE_PATH}. Build it first: node scripts/build-keeper-baseline.mjs`)
    process.exit(1)
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).keepers
  const players = JSON.parse(readFileSync(PLAYERS_PATH, 'utf8'))
  const stats = existsSync(STATS_PATH) ? JSON.parse(readFileSync(STATS_PATH, 'utf8')) : { keepers: {} }
  stats.keepers ||= {}

  let keepers = players.filter((p) => isGoalkeeper(p) && !isRetired(p))
  if (ONLY) {
    const wanted = new Set(ONLY.split(',').map((n) => n.trim()))
    keepers = keepers.filter((p) => wanted.has(p.name))
  }
  console.log(`${keepers.length} active goalkeepers${DRY ? ' (dry run)' : ''}, ${Object.keys(baseline).length} with a Footballdatabase baseline.`)

  let changed = 0
  let failed = 0
  let noBaseline = 0
  let consecutiveErrors = 0
  for (const player of keepers) {
    const base = baseline[player.id]
    if (!base) {
      noBaseline++
      console.warn(`SKIP ${player.name}: no Footballdatabase baseline - career total would be incomplete`)
      continue
    }
    try {
      const prev = stats.keepers[player.id]
      const { fotmobId, fotmobName, live } = await liveSeasons(player, prev)
      consecutiveErrors = 0

      // stored history first, then FotMob overrides the seasons it refreshed this run
      const seasons = Object.fromEntries(
        Object.entries(base.seasons).map(([label, s]) => [label, { cleanSheets: s.cleanSheets, goalsAgainst: s.goalsAgainst, source: 'footballdatabase' }])
      )
      const unmatched = []
      for (const [label, s] of Object.entries(live)) {
        if (!seasons[label]) unmatched.push(label)
        seasons[label] = { cleanSheets: s.cleanSheets, goalsAgainst: s.goalsAgainst, source: 'fotmob' }
      }
      const career = Object.values(seasons).reduce((a, s) => a + (s.cleanSheets ?? 0), 0)

      stats.keepers[player.id] = { name: player.name, fotmobId, fotmobName, seasons, careerCleanSheets: career }
      const notes = [
        sameName(fotmobName, player.name) ? '' : `NAME MISMATCH (FotMob: "${fotmobName}")`,
        unmatched.length ? `new season label(s) not in baseline: ${unmatched.join(', ')}` : '',
      ].filter(Boolean)
      console.log(`OK   ${player.name} [${fotmobId}] career clean sheets ${career} (live seasons: ${Object.keys(live).join(', ') || 'none'})${notes.length ? '  <-- ' + notes.join('; ') : ''}`)

      if (career !== (player.career_clean_sheets ?? null)) {
        if (!DRY) player.career_clean_sheets = career
        changed++
      }
    } catch (e) {
      failed++
      consecutiveErrors++
      console.error(`MISS ${player.name}: ${e.message} - keeping existing data`)
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error(`${MAX_CONSECUTIVE_ERRORS} errors in a row - stopping instead of hammering FotMob.`)
        break
      }
      await sleep(DELAY_MS * 3)
    }
    if (!DRY) {
      stats.updatedAt = new Date().toISOString()
      mkdirSync(path.dirname(STATS_PATH), { recursive: true })
      writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2) + '\n')
    }
  }

  if (!DRY) writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2) + '\n')
  console.log(`\nDone: ${changed} career totals changed, ${failed} failed, ${noBaseline} skipped (no baseline).`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
