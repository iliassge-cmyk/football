// Weekly refresh for src/data/players.json: re-fetches live FotMob data for
// every ACTIVE player (never retired/legend entries - their career is over,
// so there's nothing to refresh - see README's two-cutoff-dates section).
// A player counts as "retired" if its `club` field ends in "(retired)",
// matching this file's existing convention.
//
// Only overwrites a player's row if something actually changed (club,
// position, career_goals, career_assists, or market_value_eur) - unchanged
// players are left byte-for-byte identical, so `git diff` after a run shows
// exactly what moved, nothing else.
//
// A fetch failure never blanks out good existing data - the old row is kept
// and the miss is logged for follow-up instead.
//
// Run: node scripts/refresh-players-data.mjs
// (Intended to run in CI on a schedule - see .github/workflows/weekly-players-refresh.yml -
// which opens a PR with the resulting diff rather than committing directly,
// so a bad batch of fetches never ships unreviewed.)
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLAYERS_PATH = path.join(__dirname, '../src/data/players.json')

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
}
const FOTMOB_SEARCH_URL = 'https://apigw.fotmob.com/searchapi/suggest'
const FOTMOB_PLAYER_URL = 'https://www.fotmob.com/players/'
const NEXT_DATA_RE = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
const FOTMOB_ID_FROM_SOURCE_RE = /fotmob\.com\/players\/(\d+)/

const isRetired = (p) => /\(retired\)\s*$/i.test(p.club || '')

// players.json's `position` field is free-text, not a strict enum - existing
// entries mix several past conventions ("DF", "Defender", "Center Back",
// "Left Wing-Back", lowercase, ...) while FotMob always returns a detailed
// label ("Center Back", "Central Midfielder", ...). Comparing those strings
// directly would flag nearly every player as "changed" every week purely on
// label-detail differences, not a real positional change. Instead, both
// sides are collapsed to one of four coarse buckets for the diff check, and
// the stored text is only overwritten when the *bucket* actually changed
// (e.g. a converted full-back moved into midfield) - preserving whatever
// convention a given row already used otherwise.
function coarsePosition(label) {
  const s = (label || '').toLowerCase()
  if (/keeper|goalkeeper|\bgk\b/.test(s)) return 'GK'
  if (/back|defen|\bdf\b|center-back|centre-back/.test(s)) return 'DF'
  if (/midfield|\bmf\b/.test(s)) return 'MF'
  if (/forward|striker|wing|attack|\bfw\b/.test(s)) return 'FW'
  return null // unrecognized - don't let an unknown label force a "changed" flag
}

function slugifyClub(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function fotmobSearchPlayerId(name) {
  const url = new URL(FOTMOB_SEARCH_URL)
  url.search = new URLSearchParams({ term: name, lang: 'en', project: 'fotmob-web' }).toString()
  const resp = await fetch(url, { headers: HEADERS })
  if (!resp.ok) throw new Error(`search HTTP ${resp.status}`)
  const data = await resp.json()
  for (const group of data.squadMemberSuggest || []) {
    for (const option of group.options || []) {
      if (option.payload?.isCoach) continue
      return parseInt(option.payload.id, 10)
    }
  }
  return null
}

async function fotmobFetchRaw(playerId) {
  const resp = await fetch(FOTMOB_PLAYER_URL + playerId, { headers: HEADERS })
  if (!resp.ok) throw new Error(`profile HTTP ${resp.status}`)
  const html = await resp.text()
  const match = html.match(NEXT_DATA_RE)
  if (!match) throw new Error(`no __NEXT_DATA__ for FotMob player ${playerId}`)
  return JSON.parse(match[1]).props.pageProps.data
}

function sumField(career, field) {
  return career.reduce((sum, e) => sum + (e[field] && /^\d+$/.test(e[field]) ? parseInt(e[field]) : 0), 0)
}

function fotmobSummarize(raw) {
  const position = raw.positionDescription?.primaryPosition?.label ?? null
  const team = raw.primaryTeam || {}
  const career = raw.careerHistory?.careerItems?.senior?.teamEntries || []
  const marketValues = raw.marketValues?.values || []
  const latest = marketValues.length ? marketValues[marketValues.length - 1] : null
  return {
    fotmobId: raw.id ?? null,
    club: team.teamName ?? null,
    position,
    careerGoals: career.length ? sumField(career, 'goals') : null,
    careerAssists: career.length ? sumField(career, 'assists') : null,
    marketValueEUR: latest?.value ?? null,
  }
}

async function fetchOne(player) {
  let fotmobId = null
  const sourceMatch = (player.source || '').match(FOTMOB_ID_FROM_SOURCE_RE)
  if (sourceMatch) {
    fotmobId = parseInt(sourceMatch[1], 10)
  } else {
    fotmobId = await fotmobSearchPlayerId(player.name)
  }
  if (fotmobId == null) return null
  return fotmobSummarize(await fotmobFetchRaw(fotmobId))
}

async function pool(items, worker, concurrency) {
  const results = new Array(items.length)
  let idx = 0
  async function runner() {
    while (idx < items.length) {
      const i = idx++
      try {
        results[i] = await worker(items[i])
      } catch (e) {
        results[i] = { error: e.message }
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, runner))
  return results
}

function positionBucketChanged(player, fresh) {
  const before = coarsePosition(player.position)
  const after = coarsePosition(fresh.position)
  return before != null && after != null && before !== after
}

function hasChanged(player, fresh) {
  return (
    player.club !== fresh.club ||
    positionBucketChanged(player, fresh) ||
    (fresh.careerGoals != null && player.career_goals !== fresh.careerGoals) ||
    (fresh.careerAssists != null && player.career_assists !== fresh.careerAssists) ||
    (fresh.marketValueEUR != null && player.market_value_eur !== fresh.marketValueEUR)
  )
}

async function main() {
  const players = JSON.parse(readFileSync(PLAYERS_PATH, 'utf8'))
  const activeIdx = players.map((p, i) => i).filter((i) => !isRetired(players[i]))

  console.log(`${players.length} total players, ${activeIdx.length} active (non-retired) to check, ${players.length - activeIdx.length} legends skipped (static).`)

  const fresh = await pool(
    activeIdx.map((i) => players[i]),
    fetchOne,
    10
  )

  let changed = 0
  let failed = 0
  const today = new Date().toISOString().slice(0, 10)

  for (let k = 0; k < activeIdx.length; k++) {
    const i = activeIdx[k]
    const f = fresh[k]
    const player = players[i]

    if (!f || f.error) {
      failed++
      console.error(`MISS '${player.name}': ${f?.error || 'no FotMob match'} - keeping existing data`)
      continue
    }
    if (!hasChanged(player, f)) continue

    changed++
    const before = { club: player.club, position: player.position, career_goals: player.career_goals, career_assists: player.career_assists, market_value_eur: player.market_value_eur }
    if (f.club) {
      player.club = f.club
      player.club_crest_url = `/assets/clubs/${slugifyClub(f.club)}.svg`
    }
    if (positionBucketChanged(player, f)) player.position = f.position
    if (f.careerGoals != null) player.career_goals = f.careerGoals
    if (f.careerAssists != null) player.career_assists = f.careerAssists
    if (f.marketValueEUR != null) player.market_value_eur = f.marketValueEUR
    if (f.fotmobId != null) player.source = `https://www.fotmob.com/players/${f.fotmobId}/${slugifyClub(player.name)}`
    player.verified_date = today

    console.log(`CHANGED '${player.name}': ${JSON.stringify(before)} -> ${JSON.stringify({ club: player.club, position: player.position, career_goals: player.career_goals, career_assists: player.career_assists, market_value_eur: player.market_value_eur })}`)
  }

  writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2) + '\n')

  console.log(`\nDone: ${changed} changed, ${activeIdx.length - changed - failed} unchanged, ${failed} misses (kept as-is).`)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`) // lets the workflow skip opening an empty PR
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
