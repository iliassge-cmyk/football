import { bingoPlayer, fitsCell } from './bingo'

// The rules of a Football Bingo game as a plain function of a list of moves, so one phone and every device of an online game end up in exactly the same state:
// the players take turns; on his turn a player taps a free field and names a footballer. He fits (both categories): the field is his. He does not: a life is gone.
// A footballer can only be used once. Out of lives = no more turns. The game ends when all fields are taken or nobody has a life left; most fields win.

export const livesFor = (count) => (count === 1 ? 9 : 3)

export function newGame(count) {
  return { count, cells: Array(9).fill(null), lives: Array(count).fill(livesFor(count)), used: [], moves: 0, seat: 0 }
}

const nextSeat = (lives, from) => {
  for (let k = 1; k <= lives.length; k++) {
    const s = (from + k) % lives.length
    if (lives[s] > 0) return s
  }
  return -1
}

export const isOver = (state) => state.seat < 0 || state.cells.every(Boolean) || state.lives.every((l) => l <= 0)

/**
 * The state after a move { seat, cell, id }: cell -1 with id null is a skipped turn (costs a life, used when a player has left). Returns null when the move is not legal
 * (not his turn, field taken, footballer unknown or already on the board).
 */
export function applyMove(state, grid, move) {
  if (isOver(state) || move.seat !== state.seat) return null
  const lives = [...state.lives]
  let cells = state.cells
  let used = state.used
  if (move.cell === -1 && move.id === null) {
    lives[move.seat]--
  } else {
    const p = bingoPlayer(move.id)
    if (!p || !Number.isInteger(move.cell) || move.cell < 0 || move.cell > 8 || state.cells[move.cell] || state.used.includes(move.id)) return null
    if (fitsCell(p, grid.rows[Math.floor(move.cell / 3)], grid.cols[move.cell % 3])) {
      cells = state.cells.map((c, i) => (i === move.cell ? { seat: move.seat, id: move.id } : c))
      used = [...state.used, move.id]
    } else lives[move.seat]--
  }
  return { ...state, cells, used, lives, moves: state.moves + 1, seat: nextSeat(lives, move.seat), last: { ...move, hit: cells !== state.cells } }
}

/** Per seat: fields taken and lives left; `winners` = the seats with the most fields (ties broken by lives left). */
export function scores(state) {
  const rows = state.lives.map((lives, seat) => ({ seat, fields: state.cells.filter((c) => c?.seat === seat).length, lives }))
  const best = [...rows].sort((a, b) => b.fields - a.fields || b.lives - a.lives)[0]
  return { rows, winners: rows.filter((r) => r.fields === best.fields && r.lives === best.lives).map((r) => r.seat) }
}
