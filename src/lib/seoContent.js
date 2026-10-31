// Readable text under every public page: how the game works and a few questions people actually search for.
// Shown in the app (SeoText.jsx), written into the prerendered HTML (scripts/prerender-seo.mjs) and the source of the FAQ structured data (seoMeta.js).
// Keep it true to the game rules (the intro popups of the games): plain JS, no imports, the build script loads it too.

export const SEO_CONTENT = {
  '/': {
    heading: 'Free football trivia games in your browser',
    howTo: [
      'Pick a game on this page: daily challenges with a leaderboard, party games for friends or classic higher-or-lower duels.',
      'Play straight away on your phone or computer. Nothing to download.',
      'Optional: create a free account for leaderboards, streaks and friends.',
    ],
    faq: [
      { q: 'Is TopBin free?', a: 'Yes. Every game on TopBin is free to play. You can play without an account; a free account adds leaderboards, streaks and friends.' },
      { q: 'Which football games can I play on TopBin?', a: 'Daily Top 10, Minefield, Imposter, Bidding War, Blind Ranking, Hit the Number, Football Bingo, Transfer Duel, Goal Duel, Assist Duel, Market Value Duel and Guess the Year.' },
      { q: 'Can I play football quizzes with friends?', a: 'Yes. Imposter, Bidding War, Blind Ranking, Hit the Number and Football Bingo can be played on one phone, and most of them also online in a room with chat.' },
      { q: 'Do I need to download an app?', a: 'No. TopBin runs in your browser on phone, tablet and desktop.' },
    ],
  },
  '/game/daily-top10': {
    heading: 'How the Daily Top 10 football quiz works',
    howTo: [
      'Every day there is a new football category. Name all ten answers in any order.',
      'You have 3 lives. A wrong or repeated guess costs one life.',
      "Only today's challenge is ranked, one try per day. Past days are open for practice and never touch your ranking.",
    ],
    faq: [
      { q: 'How often does the Daily Top 10 change?', a: 'There is a new football category every day.' },
      { q: 'Can I play old Daily Top 10 challenges?', a: 'Yes. Pick a past day to practice. Only the challenge of the day counts for the leaderboard.' },
    ],
  },
  '/game/minefield': {
    heading: 'How the Minefield football quiz works',
    howTo: [
      'You see 16 tiles, each one is a footballer. A category tells you which players are safe.',
      '10 of the 16 tiles fit the category, 6 are mines. Tap only the players you think fit.',
      'Find all 10 safe tiles before you hit 4 mines. Only the category of the day counts for the leaderboard, older days are practice.',
    ],
    faq: [
      { q: 'How many mines are there in Minefield?', a: 'Six of the sixteen tiles are mines. Hitting four of them ends your run.' },
      { q: 'Is Minefield a daily game?', a: 'Yes. There is a new category every day, and you can practice on past days.' },
    ],
  },
  '/game/imposter': {
    heading: 'How the Imposter football party game works',
    howTo: [
      'Set up your players and pass the phone around. Everyone sees the same footballer card, except one secret Imposter.',
      'Go around twice and say one word connected to the player. The Imposter has to bluff.',
      'Vote out who you think the Imposter is, out loud, no phone needed.',
    ],
    faq: [
      { q: 'How many players do I need for Imposter?', a: 'It is a group game on one phone: the more friends, the more fun the bluffing gets.' },
      { q: 'What does the Imposter see?', a: 'The Imposter does not know which footballer the others are describing and has to bluff from the clues.' },
    ],
  },
  '/game/bidding-war': {
    heading: 'How the Bidding War football auction game works',
    howTo: [
      'Each team gets a budget of €20 to bid for five players.',
      'Who opens each auction rotates like a poker dealer button. Then bidding goes around the table: raise by any amount or pass. The highest bid wins the player.',
      'At the end the teams are compared side by side, with no single winner, so you can argue about it.',
    ],
    faq: [
      { q: 'Can I play Bidding War online?', a: 'Yes. Play on one phone with 2 to 4 players, in an online room for up to 4 friends with chat, in a quick match 1 vs 1 or against a bot.' },
      { q: 'How much money does each team have?', a: 'Every team starts with a budget of €20 for five players.' },
    ],
  },
  '/game/blind-ranking': {
    heading: 'How Blind Ranking with footballers works',
    howTo: [
      'A footballer appears and you must put him on a rank right away. You do not know who comes next and there is no going back.',
      'Pick any topic you like.',
      'With friends everybody ranks each footballer in turn. At the end the rankings are shown side by side.',
    ],
    faq: [
      { q: 'Is there a winner in Blind Ranking?', a: 'No points and no winner. The fun is arguing about whose ranking is better.' },
      { q: 'Can I play Blind Ranking online?', a: 'Yes, on one phone with 1 to 4 players or online with friends in a room.' },
    ],
  },
  '/game/hit-the-number': {
    heading: 'How Hit the Number works',
    howTo: [
      'A target number appears, for example 240 career goals.',
      'Take turns drafting five footballers whose numbers should add up to it. Every footballer can be taken only once.',
      'You do not see the numbers until the end. Going over is fine, only the distance to the target counts. Closest sum wins.',
    ],
    faq: [
      { q: 'Which stats are used in Hit the Number?', a: 'Career goals, career assists or market value, depending on the round.' },
      { q: 'Can I play Hit the Number online?', a: 'Yes, on one phone with 1 to 4 players or online with friends in a room with chat.' },
    ],
  },
  '/game/football-bingo': {
    heading: 'How Football Bingo works',
    howTo: [
      'You get a random 3x3 grid. Every field sits between two categories: a club, a nation, a title or a coach.',
      'Name a footballer who fits both, for example he played for the club and has the nationality.',
      'It is a duel for two. You take turns, every footballer can be used once and a wrong guess costs a life. Most fields win.',
    ],
    faq: [
      { q: 'Is the Football Bingo grid the same every day?', a: 'No. Every game has a new random grid.' },
      { q: 'Can I play Football Bingo against a friend online?', a: 'Yes. Play on one phone, in an online room for two or in a quick match.' },
    ],
  },
  '/game/transfer-duel': {
    heading: 'How the Transfer Duel works',
    howTo: [
      'You see a transfer and its fee. Guess whether the next transfer fee was higher or lower.',
      'Every correct guess adds one to your streak. One wrong guess ends the run.',
      'Your best streak is what counts on the leaderboard.',
    ],
    faq: [
      { q: 'What is a higher or lower football quiz?', a: 'You compare two values, here transfer fees, and say whether the next one is higher or lower. The longer your streak, the better.' },
      { q: 'Is Transfer Duel free?', a: 'Yes, free and without signup. An account only adds the leaderboard.' },
    ],
  },
  '/game/goal-duel': {
    heading: 'How the Goal Duel works',
    howTo: [
      'Two footballers, one stat: career goals. Guess whether the next player scored more or fewer than the one shown.',
      'Every correct guess adds one to your streak. One wrong guess ends the run.',
      'Goalkeepers are left out, and only well-known players appear.',
    ],
    faq: [
      { q: 'Which players are in the Goal Duel?', a: 'Well-known outfield players and retired legends with a meaningful number of career goals. Goalkeepers are excluded.' },
      { q: 'How do I get on the leaderboard?', a: 'Build the longest streak. Your best streak is saved for your account.' },
    ],
  },
  '/game/assist-duel': {
    heading: 'How the Assist Duel works',
    howTo: [
      'Guess whether the next footballer has more or fewer career assists than the one shown.',
      'Every correct guess adds one to your streak. One wrong guess ends the run.',
      'Goalkeepers are left out, and only well-known players appear.',
    ],
    faq: [
      { q: 'What counts as a correct guess in the Assist Duel?', a: "You say higher or lower and the next player's career assists decide it." },
      { q: 'Is the Assist Duel free?', a: 'Yes, free and without signup.' },
    ],
  },
  '/game/market-value': {
    heading: 'How the Market Value Duel works',
    howTo: [
      "Guess whether the next player's market value is higher or lower than the one shown.",
      'The values are estimates as of summer 2026. Every correct guess adds one to your streak, one wrong guess ends the run.',
      'Your best streak goes on the leaderboard.',
    ],
    faq: [
      { q: 'Where do the market values come from?', a: 'They are market value estimates as of summer 2026 and can differ from other sources.' },
      { q: 'Is the Market Value Duel free?', a: 'Yes, free and without signup.' },
    ],
  },
  '/game/guess-the-year': {
    heading: 'How Guess the Year works',
    howTo: [
      'You see a famous football match and its scorers.',
      'Drag the slider to the year you think it was played.',
      'Land within 2 years and your streak grows by one. Miss by more and the run ends. Your best streak goes on the leaderboard.',
    ],
    faq: [
      { q: 'How close do I have to be in Guess the Year?', a: 'Within 2 years of the real year keeps your streak alive.' },
      { q: 'Which matches are in the game?', a: 'Famous football matches from the past decades.' },
    ],
  },
}
