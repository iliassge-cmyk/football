// Adds transfers from the one-time Footballdatabase export (exports/fbd_all.json) to src/data/transfers.json
// for the Transfer Duel.
//
//   - only paid moves ("Fee" rows) with a known previous club and a fee of at least MIN_FEE_EUR_M million EUR
//   - year = year of the start date of the stay at the new club
//   - the 86 hand-checked transfers already in transfers.json are kept untouched; a Footballdatabase move is skipped
//     when the same player already has a transfer in that year with a similar fee
//
// Usage: node scripts/build-transfers-from-fbd.mjs [exports/fbd_all.json] [--dry-run]
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const exportFile = args.find((a) => !a.startsWith('--')) || path.join(__dirname, '../exports/fbd_all.json')
const OUT = path.join(__dirname, '../src/data/transfers.json')
const MIN_FEE_EUR_M = 14

const slug = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// Footballdatabase's short club labels -> the names the rest of the app uses
const CLUB_ALIASES = {
  'Paris SG': 'Paris Saint-Germain',
  Bayern: 'Bayern Munich',
  'Bayern Munchen': 'Bayern Munich',
  Inter: 'Inter Milan',
  'Inter Milano': 'Inter Milan',
  'AC Milan': 'AC Milan',
  Dortmund: 'Borussia Dortmund',
  Leverkusen: 'Bayer Leverkusen',
  Monaco: 'AS Monaco',
  Tottenham: 'Tottenham Hotspur',
  'West Ham': 'West Ham United',
  Wolverhampton: 'Wolverhampton Wanderers',
  'Brighton & Hove': 'Brighton & Hove Albion',
  Leicester: 'Leicester City',
  'Ajax Amsterdam': 'Ajax',
  Hambourg: 'Hamburger SV',
  'Rapid Vienne': 'Rapid Wien',
  'Glasgow Rangers': 'Rangers',
  'Celtic Glasgow': 'Celtic',
  'Zenit St.Petersburg': 'Zenit Saint Petersburg',
  'Sevilla FC': 'Sevilla',
  'Valencia CF': 'Valencia',
  'Toulouse FC': 'Toulouse',
}
const clubName = (c) => CLUB_ALIASES[c.trim()] ?? c.trim()
// youth / reserve sides: a fee "into" or "out of" them is an internal or club-youth move, not a trivia-worthy transfer
const isYouthOrReserve = (c) => /\bU-?\d{2}\b|\bB$|\bII$|Castilla|Liefering|Mestalla|Jong\b/i.test(c)

const existing = JSON.parse(readFileSync(OUT, 'utf8'))
const data = JSON.parse(readFileSync(exportFile, 'utf8'))
const today = new Date().toISOString().slice(0, 10)

const hand = existing.filter((t) => !t.source?.includes('footballdatabase.eu'))
const takenIds = new Set(hand.map((t) => t.id))
const similar = (a, b) => Math.abs(a - b) <= 0.25 * Math.max(a, b)

const added = []
let tooCheap = 0
let noFrom = 0
let dupes = 0
let youth = 0
for (const r of data.results) {
  for (const t of r.transfers ?? []) {
    if (t.type !== 'Fee' || t.feeEurM == null) continue
    if (t.feeEurM < MIN_FEE_EUR_M) {
      tooCheap++
      continue
    }
    if (!t.fromClub || !t.from) {
      noFrom++
      continue
    }
    if (isYouthOrReserve(t.club) || isYouthOrReserve(t.fromClub) || clubName(t.club) === clubName(t.fromClub)) {
      youth++
      continue
    }
    const year = Number(t.from.slice(0, 4))
    const feeEur = Math.round(t.feeEurM * 1_000_000)
    const name = r.profile.inGameName
    // same move = same player, year +-1 and either the same destination club or a similar fee
    // (a differing fee for the same club move, e.g. with a player swap included, must not create a second entry)
    const toKey = slug(clubName(t.club))
    const clash = hand.some(
      (h) =>
        slug(h.player_name) === slug(name) &&
        Math.abs(h.year - year) <= 1 &&
        (slug(h.to_club) === toKey || slug(h.to_club).includes(toKey) || toKey.includes(slug(h.to_club)) || similar(h.fee_eur, feeEur))
    )
    if (clash) {
      dupes++
      continue
    }
    let id = `${slug(name)}-${slug(clubName(t.club))}-${year}`
    for (let n = 2; takenIds.has(id); n++) id = `${slug(name)}-${slug(clubName(t.club))}-${year}-${n}`
    takenIds.add(id)
    added.push({
      id,
      player_name: name,
      from_club: clubName(t.fromClub),
      to_club: clubName(t.club),
      year,
      fee_eur: feeEur,
      source: `https://www.footballdatabase.eu/en/player/details/${r.profile.fbdId}`,
      verified_date: today,
    })
  }
}

added.sort((a, b) => b.year - a.year || b.fee_eur - a.fee_eur)
const result = [...hand, ...added]
console.log(`${hand.length} hand-checked kept, ${added.length} added from Footballdatabase (fee >= ${MIN_FEE_EUR_M}M).`)
console.log(`skipped: ${tooCheap} below ${MIN_FEE_EUR_M}M, ${noFrom} without previous club/date, ${youth} youth/reserve sides, ${dupes} already present.`)
const byYear = {}
for (const t of result) byYear[t.year] = (byYear[t.year] || 0) + 1
console.log('per year:', JSON.stringify(byYear))
console.log('top 5:', added.slice().sort((a, b) => b.fee_eur - a.fee_eur).slice(0, 5).map((t) => `${t.player_name} ${t.from_club}->${t.to_club} ${t.year} ${t.fee_eur / 1e6}M`).join(' | '))
if (!DRY) {
  writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n')
  console.log(`Wrote ${OUT}`)
}
