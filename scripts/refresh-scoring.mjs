// Weekly career goals and assists.
//
//   career = Footballdatabase history (data/extended/scoring_baseline.json, built by scripts/build-scoring-baseline.mjs)
//          + the newest LIVE_SEASONS seasons re-read from FotMob every run (club competitions only, they replace the
//            stored value for exactly those season labels)
//          + national team: FotMob's current senior national-team total (never lower than the stored one)
//
// Only active players are processed - retired ones keep the baseline value (their career is over). Result:
// players.json gets `career_goals` / `career_assists`.
//
// Safety rules (a miss never makes a number worse):
//   - a FotMob season replaces the stored one only if ALL its club tournaments have deep stats (otherwise FotMob would
//     under-count, e.g. a league without player stats) and its label has the same format as the baseline's labels
//   - FotMob IDs from players.json `source` are trusted; IDs found via search must match the player's name
//   - any error keeps the existing numbers; 5 errors in a row stop the run
//
// Usage: node scripts/refresh-scoring.mjs      Options: --only "Name1,Name2"   --dry-run (no files written)
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLAYERS_PATH = path.join(__dirname, '../src/data/players.json')
const BASELINE_PATH = path.join(__dirname, '../data/extended/scoring_baseline.json')

const args = process.argv.slice(2)
const argValue = (flag) => (args.indexOf(flag) >= 0 ? args[args.indexOf(flag) + 1] : null)
const DRY = args.includes('--dry-run')
const ONLY = argValue('--only')
const LIVE_SEASONS = 2
const DELAY_MS = 250
const CONCURRENCY = 4
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
// youth / Olympic national sides are not part of the senior national-team total
const isSeniorNationalEntry = (team) => !/\bU-?\d{2}\b|olympi|\bB\b/i.test(team || '')

// Same person, different transliteration: in-game name -> the name FotMob uses (only for search-resolved players)
const FOTMOB_SPELLING = {
  'Evan Ndicka': "Evan N'Dicka",
  'Charalampos Lykogiannis': 'Charalambos Lykogiannis',
  'Leart Paqarada': 'Leart Paçarada',
  'Ruslan Malinovskyi': 'Ruslan Malinovsky',
  'Mykhailo Mudryk': 'Mykhaylo Mudryk',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const isRetired = (p) => /\(retired\)\s*$/i.test(p.club || '')
const num = (v) => (v != null && /^\d+$/.test(String(v)) ? parseInt(v, 10) : null)
const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const sameName = (a, b) => {
  const ta = fold(a).split(' ').filter(Boolean)
  const tb = fold(b).split(' ').filter(Boolean)
  return ta.length > 0 && tb.length > 0 && (ta.every((t) => tb.includes(t)) || tb.every((t) => ta.includes(t)))
}
const startYear = (label) => {
  const m = /^(\d{4})/.exec(label || '')
  return m ? Number(m[1]) : null
}
const labelShape = (label) => (label || '').replace(/\d/g, '9')

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

/** Club goals/assists of the newest LIVE_SEASONS seasons: { "2025/2026": [goals, assists] } (complete seasons only). */
async function liveSeasons(fotmobId, raw, notes) {
  const out = {}
  for (const season of (raw.statSeasons || []).slice(0, LIVE_SEASONS)) {
    const club = (season.tournaments || []).filter((t) => !isNationalTeamTournament(t.name))
    if (!club.length) continue
    if (club.some((t) => !t.hasDeepStats)) {
      notes.push(`${season.seasonName}: not every club competition has stats on FotMob - kept Footballdatabase value`)
      continue
    }
    let goals = 0
    let assists = 0
    let seen = false
    for (const t of club) {
      const stats = await fotmobEntryStats(fotmobId, t.entryId)
      await sleep(DELAY_MS)
      if (stats['Goals'] == null && stats['Assists'] == null) continue // competition without scoring stats (e.g. no appearance)
      seen = true
      goals += num(stats['Goals']) ?? 0
      assists += num(stats['Assists']) ?? 0
    }
    if (seen) out[season.seasonName] = [goals, assists]
  }
  return out
}

/** Senior national-team totals from FotMob's career section, or null when it has none. */
function nationalTotals(raw) {
  const entries = (raw.careerHistory?.careerItems?.['national team']?.teamEntries || []).filter((e) => isSeniorNationalEntry(e.team))
  if (!entries.length) return null
  let goals = 0
  let assists = 0
  for (const e of entries) {
    goals += num(e.goals) ?? 0
    assists += num(e.assists) ?? 0
  }
  return [goals, assists]
}

async function refreshPlayer(player, base) {
  const notes = []
  let fotmobId
  const fromSource = (player.source || '').match(FOTMOB_ID_FROM_SOURCE_RE)
  let trusted = false
  if (fromSource) {
    fotmobId = parseInt(fromSource[1], 10)
    trusted = true
  } else {
    fotmobId = await fotmobSearchPlayerId(player.name)
    await sleep(DELAY_MS)
  }
  if (!fotmobId) throw new Error('no FotMob match')

  const raw = await fotmobProfile(fotmobId)
  await sleep(DELAY_MS)
  if (!trusted && !sameName(raw.name, player.name) && FOTMOB_SPELLING[player.name] !== raw.name) throw new Error(`FotMob search found "${raw.name}" - not the same person, skipped`)

  const seasons = { ...base.seasons }
  let live = {}
  // newest baseline label ("2026/2027" or "2026" for calendar-year leagues) decides which label format counts as new
  const labels = Object.keys(base.seasons).sort((a, b) => (startYear(b) ?? 0) - (startYear(a) ?? 0) || b.length - a.length)
  const newestBase = labels.length ? startYear(labels[0]) ?? 0 : 0
  const shape = labels.length ? labelShape(labels[0]) : null
  const fresh = await liveSeasons(fotmobId, raw, notes)
  for (const [label, val] of Object.entries(fresh)) {
    // FotMob only tops up the recent past: a player without current seasons on FotMob keeps the historical values
    if ((startYear(label) ?? 0) < newestBase - 1) {
      notes.push(`${label}: older than the baseline's newest seasons - kept baseline`)
      continue
    }
    if (!(label in seasons) && shape && labelShape(label) !== shape) {
      notes.push(`${label}: label format differs from baseline (${labels[0]}) - kept baseline`)
      continue
    }
    const y = startYear(label)
    if (!(label in seasons) && y != null && y <= newestBase) {
      notes.push(`${label}: not in baseline although older than its newest season - not added`)
      continue
    }
    seasons[label] = val
    live[label] = val
  }

  let national = base.national
  const nat = nationalTotals(raw)
  if (nat) national = [Math.max(nat[0], base.national[0]), Math.max(nat[1], base.national[1])]

  const clubGoals = Object.values(seasons).reduce((a, s) => a + s[0], 0)
  const clubAssists = Object.values(seasons).reduce((a, s) => a + s[1], 0)
  return { fotmobId, goals: clubGoals + national[0], assists: clubAssists + national[1], live: Object.keys(live), notes }
}

async function main() {
  if (!existsSync(BASELINE_PATH)) {
    console.error(`Missing ${BASELINE_PATH}. Build it first: node scripts/build-scoring-baseline.mjs`)
    process.exit(1)
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).players
  const players = JSON.parse(readFileSync(PLAYERS_PATH, 'utf8'))

  let todo = players.filter((p) => !isRetired(p))
  if (ONLY) {
    const wanted = new Set(ONLY.split(',').map((n) => n.trim()))
    todo = todo.filter((p) => wanted.has(p.name))
  }
  console.log(`${todo.length} active players${DRY ? ' (dry run)' : ''}, ${Object.keys(baseline).length} with a Footballdatabase baseline.`)

  const today = new Date().toISOString().slice(0, 10)
  let changed = 0
  let failed = 0
  let noBaseline = 0
  let consecutiveErrors = 0
  let stop = false
  let next = 0

  async function worker() {
    while (!stop && next < todo.length) {
      const player = todo[next++]
      const base = baseline[player.id]
      if (!base) {
        noBaseline++
        console.warn(`SKIP ${player.name}: no Footballdatabase baseline`)
        continue
      }
      try {
        const r = await refreshPlayer(player, base)
        consecutiveErrors = 0
        const moved = r.goals !== player.career_goals || r.assists !== player.career_assists
        console.log(
          `${moved ? 'CHANGED' : 'OK     '} ${player.name} [${r.fotmobId}] goals ${player.career_goals} -> ${r.goals}, assists ${player.career_assists} -> ${r.assists} (live: ${r.live.join(', ') || 'none'})${r.notes.length ? '  <-- ' + r.notes.join('; ') : ''}`
        )
        if (moved) {
          changed++
          if (!DRY) {
            player.career_goals = r.goals
            player.career_assists = r.assists
            player.verified_date = today
          }
        }
      } catch (e) {
        failed++
        consecutiveErrors++
        console.error(`MISS ${player.name}: ${e.message} - keeping existing numbers`)
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error(`${MAX_CONSECUTIVE_ERRORS} errors in a row - stopping instead of hammering FotMob.`)
          stop = true
        } else {
          await sleep(DELAY_MS * 3)
        }
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  if (!DRY) writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2) + '\n')
  console.log(`\nDone: ${changed} changed, ${failed} failed, ${noBaseline} skipped (no baseline).`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
