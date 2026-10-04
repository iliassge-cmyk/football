// Display names for the internal game keys (the keys are what the database stores).
export const GAME_LABELS = {
  daily_top10: 'Daily Top 10',
  minefield: 'Minefield',
  goal_duel: 'Goal Duel',
  market_value_duel: 'Market Value Duel',
  assist_duel: 'Assist Duel',
  transfer_duel: 'Transfer Duel',
  guess_the_year: 'Guess the Year',
}

export const gameLabel = (key) => GAME_LABELS[key] ?? key
