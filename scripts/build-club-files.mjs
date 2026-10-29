// The club master table (src/data/clubs.json) is the ONE place for club names, aliases, logo and coordinates.
// This script (re)generates everything that used to be edited by hand:
//   - clubs without a logo key get one when a logo file for the club exists (marketing/clublogos2/<slug>.png and meta says found)
//   - marketing/clublogos2/aliases.json            (every club spelling -> logo key; used by the video and quiz renderers)
//   - topbin-content/data/club_logos.json          (every club spelling -> logo key or null; used by the Guess-the-Player reels)
//   - topbin-content/data/club_coords.json, club_world.json (every club spelling -> coordinates; map of the reels)
//   node scripts/build-club-files.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const KS = 'C:/Users/Iman/.claude/KI Schnitt Video testen/topbin-content/data'
const LOGOS = `${R}/marketing/clublogos2`
const J = (f) => JSON.parse(readFileSync(f, 'utf8'))
const slug = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const clubs = J(`${R}/src/data/clubs.json`)
const meta = J(`${LOGOS}/meta.json`)
const oldCoords = existsSync(`${KS}/club_coords.json`) ? J(`${KS}/club_coords.json`) : {}

let newLogos = 0
for (const c of clubs) {
  if (c.logo && existsSync(`${LOGOS}/${c.logo}.png`)) continue
  c.logo = null
  for (const key of [slug(c.name), ...c.aliases.map(slug)]) if (existsSync(`${LOGOS}/${key}.png`) && meta[key]?.found !== false) { c.logo = key; newLogos++; break }
}
const aliasesOut = {}, logosOut = {}, coordsOut = { _info: oldCoords._info ?? 'Stadtkoordinaten [lon, lat] der Vereine (generated from src/data/clubs.json, do not edit by hand).' }, worldOut = {}
for (const c of clubs) for (const n of [c.name, ...c.aliases]) {
  logosOut[n] = c.logo ?? null
  if (c.logo) aliasesOut[n] = c.logo
  if (c.lon != null) { coordsOut[n] = [c.lon, c.lat]; worldOut[n] = { name: n, logo: c.logo, lon: c.lon, lat: c.lat } }
}
writeFileSync(`${R}/src/data/clubs.json`, JSON.stringify(clubs, null, 2) + '\n')
writeFileSync(`${LOGOS}/aliases.json`, JSON.stringify(aliasesOut, null, 2) + '\n')
writeFileSync(`${KS}/club_logos.json`, JSON.stringify(logosOut, null, 1) + '\n')
writeFileSync(`${KS}/club_coords.json`, JSON.stringify(coordsOut, null, 1) + '\n')
writeFileSync(`${KS}/club_world.json`, JSON.stringify(worldOut, null, 1) + '\n')
const real = clubs.filter((c) => !c.reserve && c.type !== 'national_team')
console.log(`clubs ${clubs.length} | logo for ${real.filter((c) => c.logo).length} of ${real.length} real clubs (${newLogos} newly linked) | coordinates for ${clubs.filter((c) => c.lon != null).length}`)
console.log('still without logo:', real.filter((c) => !c.logo).map((c) => c.name).slice(0, 40).join(', '))
