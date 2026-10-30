import players from '../data/players.json'
import grids from '../data/bingo_daily.json'
import { todayCET } from './challengeApi'

// Football Bingo: 3 categories on top, 3 on the left; fill each cell with a footballer who fits both. The grids are made by scripts/build-bingo.mjs
// (every cell has at least 3 solutions); the check here uses the same data (players.json: clubs, nationality, titles).

export const MAX_GUESSES = 9
const TITLE_ALIAS = { 'Uefa Cup winner': 'Europa League winner', 'FIFA Intercontinental Cup Winner': 'Intercontinental Cup winner' } // two Transfermarkt names, one category

export const BINGO_PLAYERS = players.filter((p) => Array.isArray(p.clubs) && p.clubs.length)

function hasTitle(p, key) {
  const t = p.titles ?? {}
  if ((t[key] ?? 0) > 0) return true
  return Object.keys(TITLE_ALIAS).some((k) => TITLE_ALIAS[k] === key && (t[k] ?? 0) > 0)
}

/** Does the footballer fit the category ({ type: 'club' | 'nat' | 'title', key })? */
export function fits(p, cat) {
  if (cat.type === 'club') return p.clubs?.includes(cat.key) ?? false
  if (cat.type === 'nat') return p.nationality === cat.key
  return hasTitle(p, cat.key)
}

export const fitsCell = (p, row, col) => fits(p, row) && fits(p, col)
export const solutionsOf = (row, col) => BINGO_PLAYERS.filter((p) => fitsCell(p, row, col))

/** The grid of a day; a day without a prepared grid takes one of the prepared ones (the list is cycled, never empty). */
export function gridFor(date = todayCET()) {
  return grids.find((g) => g.date === date) ?? grids[Math.abs(hashCode(date)) % grids.length]
}
function hashCode(s) {
  let h = 0
  for (const c of s) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0
  return h
}
