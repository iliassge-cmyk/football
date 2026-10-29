// One-off data clean-up (2026-10-28), Transfermarkt (tmapi) spelling is the reference.
//   node scripts/clean-data.mjs [--dry]
// 1. builds the club master table src/data/clubs.json (one canonical name per real club + aliases + logo + coordinates) and runs players, transfers and matches through it
//    (club names unified, every file gets club ids: club_id / from_club_id / to_club_id / home_id / away_id)
// 2. players.json: the status leaves the club name: "Real Madrid (retired)" -> club "Real Madrid" + status "retired"; "Free agent (formerly X)" -> club "X" + status "free_agent"
// 5. transfers.json: where Transfermarkt knows the same transfer (player, year, target club), its fee is used (the previous value is kept in fee_eur_previous)
// 3./6. regenerates topbin-content/data/club_logos.json, club_coords.json, club_world.json from the master table (nobody edits those by hand any more)
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const R = path.resolve(here, '..')
const KS = 'C:/Users/Iman/.claude/KI Schnitt Video testen/topbin-content/data'
const DRY = process.argv.includes('--dry')
const J = (f) => JSON.parse(readFileSync(f, 'utf8'))
const CHAR_MAP = { ł: 'l', ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', đ: 'd', ð: 'd', þ: 'th', ı: 'i', ŋ: 'n' }
const fold = (s) => String(s).toLowerCase().split('').map((c) => CHAR_MAP[c] ?? c).join('').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const ns = (s) => fold(String(s).trim())
const slug = (s) => ns(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// ---- the alias table the site already has (old spelling -> Transfermarkt spelling)
const ALIAS = JSON.parse(/const ALIAS = (\{[\s\S]*?\n\})/.exec(readFileSync(`${R}/src/lib/clubAlias.js`, 'utf8'))[1])
// ---- same club, different spelling (decided by hand after the audit); different clubs with a similar name are NOT listed here (Milan/Inter, Torino/Toronto, Rangers/QPR, Independiente/Independiente del Valle ...)
const SAME = [
  ['Al-Nassr FC', 'Al Nassr Riyadh'], ['Deportivo de La Coruña', 'Deportivo A Coruña'], ['Deportivo de La Coruña', 'Deportivo La Coruña'], ['Istanbul Başakşehir', 'Basaksehir FK'],
  ['Feyenoord Rotterdam', 'Feyenoord'], ['Brighton & Hove Albion', 'Brighton'], ['Dynamo Moscow', 'Dinamo Moscow'], ['CR Flamengo', 'Flamengo'], ['Grêmio Foot-Ball Porto Alegrense', 'Grêmio'],
  ['Al-Ettifaq FC', 'Al-Ittifaq FC'], ['Al-Ettifaq FC', 'Ettifaq FC'], ['HNK Hajduk Split', 'Hajduk Split'], ['FC Basel 1893', 'FC Basel'], ['Blackburn Rovers', 'Blackburn'],
  ['Stade de Reims', 'Reims'], ['Hamburger SV', 'Hamburg'], ['Guangzhou FC', 'Guangzhou Evergrande'], ['Al-Ittihad Club', 'Al Ittihad Jeddah'],
]
const sameMap = new Map()
for (const [to, from] of SAME) sameMap.set(ns(from), to)

const players = J(`${R}/src/data/players.json`)
const transfers = J(`${R}/src/data/transfers.json`)
const matches = J(`${R}/src/data/matches.json`)
const clubLogos = J(`${KS}/club_logos.json`), clubCoords = J(`${KS}/club_coords.json`), clubWorld = J(`${KS}/club_world.json`)
const logoAliases = J(`${R}/marketing/clublogos2/aliases.json`)
const tmTransfers = existsSync(`${KS}/transfers_tm.json`) ? J(`${KS}/transfers_tm.json`) : []

// ---- 1. raw names -> canonical club -----------------------------------------------------------------------------------------------------------------
const stripStatus = (n) => String(n ?? '').trim().replace(/^free agent \(formerly (.+)\)$/i, '$1').replace(/\s*\(retired\)\s*$/i, '').trim()
const step1 = (n) => { const x = stripStatus(n); const a = ALIAS[ns(x)] ?? x; return sameMap.get(ns(a)) ?? a }
const GEN = /\b(fc|cf|ac|as|sc|ssc|sl|sv|sk|fk|ud|cd|rcd|acf|afc|vfb|vfl|rb|us|ca|club|calcio|de|del|la|le|1|04|05|1909|1846|1913|1907)\b/g
const key = (n) => ns(n).replace(/[^a-z0-9 ]+/g, ' ').replace(GEN, ' ').replace(/\s+/g, ' ').trim()
const isReserve = (n) => /\b(II|B|U\d\d|Reserves?)$/.test(n)
const raw = new Map() // canonical-after-step1 -> { names:Set, p:count, srcs:Set }
const seen = (n, src) => { n = stripStatus(n); if (!n || n === '_info') return; const c = step1(n); const e = raw.get(c) ?? { names: new Set(), p: 0, srcs: new Set() }; e.names.add(n); e.srcs.add(src); if (src === 'players') e.p++; raw.set(c, e) }
for (const p of players) seen(p.club, 'players')
for (const t of transfers) { seen(t.from_club, 'transfers'); seen(t.to_club, 'transfers') }
for (const m of matches) { seen(m.home_team, 'matches'); seen(m.away_team, 'matches') }
for (const k of Object.keys(clubLogos)) seen(k, 'club_logos')
for (const k of Object.keys(clubCoords)) seen(k, 'club_coords')
for (const k of Object.keys(clubWorld)) seen(k, 'club_world')
for (const k of Object.keys(logoAliases)) seen(k, 'logo_aliases')
const groups = new Map()
for (const c of raw.keys()) { const k = isReserve(c) ? `reserve:${key(c)}` : key(c); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c) }
const aliasTargets = new Set(Object.values(ALIAS))
const score = (c) => { const e = raw.get(c); return (e.p ? 1000 + e.p : 0) + (aliasTargets.has(c) ? 500 : 0) + (e.srcs.has('club_world') ? 200 : 0) + (e.srcs.has('club_coords') ? 100 : 0) + (e.srcs.has('club_logos') ? 50 : 0) + c.length / 100 }
const clubs = []
const idOfName = new Map() // every raw spelling (folded) -> club id
for (const [, members] of groups) {
  members.sort((a, b) => score(b) - score(a))
  const name = members[0]
  const aliases = new Set()
  for (const c of members) { aliases.add(c); for (const n of raw.get(c).names) aliases.add(n) }
  aliases.delete(name)
  const id = slug(name)
  clubs.push({ id, name, aliases: [...aliases].sort(), _all: [name, ...aliases] })
}
const ids = new Set(); for (const c of clubs) { let i = c.id, n = 2; while (ids.has(i)) i = `${c.id}-${n++}`; c.id = i; ids.add(i) }
for (const c of clubs) for (const n of c._all) idOfName.set(ns(n), c.id)
const byId = new Map(clubs.map((c) => [c.id, c]))
// every spelling that the files used before and the site alias table maps
for (const [old, to] of Object.entries(ALIAS)) if (!idOfName.has(old) && idOfName.has(ns(to))) idOfName.set(old, idOfName.get(ns(to)))
const clubOf = (n) => { const s = stripStatus(n); const id = idOfName.get(ns(s)) ?? idOfName.get(ns(step1(s))); return id ? byId.get(id) : null }

// ---- logo + coordinates per club (from the old per-name files; first hit wins)
for (const c of clubs) {
  let logo = null, lon = null, lat = null, world = false
  for (const n of c._all) {
    if (!logo && clubLogos[n]) logo = clubLogos[n]
    if (!logo && logoAliases[n]) logo = logoAliases[n]
    if (clubCoords[n] && Array.isArray(clubCoords[n]) && lon == null) [lon, lat] = clubCoords[n]
    if (clubWorld[n] && lon == null) { lon = clubWorld[n].lon; lat = clubWorld[n].lat; world = true; if (!logo) logo = clubWorld[n].logo }
  }
  c.logo = logo; if (lon != null) { c.lon = lon; c.lat = lat }
  if (isReserve(c.name)) c.reserve = true
}

// ---- 2. players: status out of the club name, club id in ----------------------------------------------------------------------------------------------
const report = { clubs: clubs.length, rawNames: [...raw.values()].reduce((n, e) => n + e.names.size, 0), playersStatus: { retired: 0, free_agent: 0 }, playersClubRenamed: 0, playersNoClub: [], transfersRenamed: 0, matchesRenamed: 0, feeChanged: [], feeAdded: 0 }
for (const p of players) {
  const rawClub = String(p.club ?? '')
  const retired = /\(retired\)\s*$/i.test(rawClub)
  const free = /^free agent/i.test(rawClub)
  const c = clubOf(rawClub)
  if (retired) { p.status = 'retired'; report.playersStatus.retired++ } else if (free) { p.status = 'free_agent'; report.playersStatus.free_agent++ } else if (p.status) delete p.status
  if (c) { if (p.club !== c.name) report.playersClubRenamed++; p.club = c.name; p.club_id = c.id } else { p.club = stripStatus(rawClub) || p.club; report.playersNoClub.push(`${p.name}: "${rawClub}"`) }
}
// ---- 1b. transfers and matches -------------------------------------------------------------------------------------------------------------------------
for (const t of transfers) {
  for (const [f, idf] of [['from_club', 'from_club_id'], ['to_club', 'to_club_id']]) { const c = clubOf(t[f]); if (c) { if (t[f] !== c.name) report.transfersRenamed++; t[f] = c.name; t[idf] = c.id } }
}
for (const m of matches) {
  for (const [f, idf] of [['home_team', 'home_id'], ['away_team', 'away_id']]) { const c = clubOf(m[f]); if (c) { if (m[f] !== c.name) report.matchesRenamed++; m[f] = c.name; m[idf] = c.id } }
}
// ---- 5. the fee: Transfermarkt where it knows the same transfer ----------------------------------------------------------------------------------------
const normName = (s) => ns(s).replace(/[^a-z0-9]+/g, ' ').trim()
const tmIdx = new Map()
for (const t of tmTransfers) { const c = clubOf(t.to_club); tmIdx.set(`${normName(t.player_name)}|${t.year}|${c?.id ?? key(t.to_club)}`, t) }
for (const t of transfers) {
  const hit = tmIdx.get(`${normName(t.player_name)}|${t.year}|${t.to_club_id ?? key(t.to_club)}`)
  if (!hit) continue
  t.fee_source = 'transfermarkt'
  if ((hit.fee_eur ?? 0) !== (t.fee_eur ?? 0)) {
    if (Math.abs((hit.fee_eur ?? 0) - (t.fee_eur ?? 0)) > 1e6) report.feeChanged.push(`${t.player_name} ${t.year}: ${(t.fee_eur ?? 0) / 1e6}m -> ${(hit.fee_eur ?? 0) / 1e6}m`)
    t.fee_eur_previous = t.fee_eur
    t.fee_eur = hit.fee_eur ?? 0
  }
  report.feeAdded++
}

// ---- write ---------------------------------------------------------------------------------------------------------------------------------------------
const master = clubs.map(({ _all, ...c }) => c).sort((a, b) => a.name.localeCompare(b.name))
const withName = (a) => a
// topbin-content/data: the three club files are now generated from the master table (keys = every spelling, as before)
const outLogos = {}, outCoords = { _info: clubCoords._info ?? 'Stadtkoordinaten [lon, lat] der Vereine (generated from src/data/clubs.json, do not edit by hand).' }, outWorld = {}
for (const c of clubs) for (const n of c._all) {
  if (c.logo) outLogos[n] = c.logo; else outLogos[n] = null
  if (c.lon != null) { outWorld[n] = { name: n, logo: c.logo, lon: c.lon, lat: c.lat } }
}
for (const c of clubs) if (c.lon != null) for (const n of c._all) outCoords[n] = [c.lon, c.lat]
if (process.argv.includes('--list')) for (const c of master.filter((x) => x.aliases.length)) console.log(`${c.name}  <=  ${c.aliases.join(' | ')}`)
console.log(JSON.stringify({ ...report, feeChanged: report.feeChanged.length, playersNoClub: report.playersNoClub.length, withLogo: master.filter((c) => c.logo).length, withCoords: master.filter((c) => c.lon != null).length }, null, 1))
console.log('players without a matching club:', report.playersNoClub.slice(0, 10).join(' ; '))
console.log('fee changes (> 1m):', report.feeChanged.slice(0, 40).join(' ; '))
if (!DRY) {
  writeFileSync(`${R}/src/data/clubs.json`, JSON.stringify(master, null, 2) + '\n')
  writeFileSync(`${R}/src/data/players.json`, JSON.stringify(players, null, 2) + '\n')
  writeFileSync(`${R}/src/data/transfers.json`, JSON.stringify(transfers, null, 2) + '\n')
  writeFileSync(`${R}/src/data/matches.json`, JSON.stringify(matches, null, 2) + '\n')
  writeFileSync(`${KS}/club_logos.json`, JSON.stringify(outLogos, null, 1) + '\n')
  writeFileSync(`${KS}/club_coords.json`, JSON.stringify(outCoords, null, 1) + '\n')
  writeFileSync(`${KS}/club_world.json`, JSON.stringify(outWorld, null, 1) + '\n')
  console.log('written')
} else console.log('(dry run: nothing written)')
