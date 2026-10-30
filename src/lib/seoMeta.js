// What search engines and link previews should see for every public page: title, description, a short crawlable text.
// One source for three users: the browser (pageTitle.js keeps the head tags in sync while people navigate), the build step
// (scripts/prerender-seo.mjs writes a real HTML file per page and the sitemap) - so Google and the WhatsApp/TikTok/X link previews
// get the right title and text even though the app itself is a single page. Plain JS, no imports: the build script loads it too.

export const SITE = 'https://topbingames.com'
export const OG_IMAGE = `${SITE}/og-image.jpg`
export const SOCIAL_PROFILES = ['https://www.instagram.com/topbingames_official/', 'https://x.com/TopBinGames', 'https://www.tiktok.com/@topbingames']

export const SEO_PAGES = {
  '/': {
    title: 'TopBin | Free Football Trivia Games',
    description: 'Free football trivia games: Daily Top 10, Minefield, Bidding War, Blind Ranking, Imposter and higher-or-lower duels. No signup. Play alone or with friends.',
    h1: 'Free football trivia games',
    intro: 'Play the daily football challenges, rank footballers blind, bid against your friends and climb the leaderboard. Everything is free and works on your phone.',
  },
  '/game/daily-top10': {
    title: 'Daily Top 10 - Football Quiz Challenge | TopBin',
    description: 'Name all 10 players of a new football category every day. One ranked try per day, climb the leaderboard. Free, no signup.',
    h1: 'Daily Top 10 football quiz',
    intro: 'A new football category every day. Name all ten players - you get one ranked try per day.',
  },
  '/game/minefield': {
    title: 'Minefield - Football Quiz with Hidden Bombs | TopBin',
    description: '16 footballers, 6 are bombs. Tap only the players who fit the category and avoid the mines. A new daily challenge, free to play.',
    h1: 'Minefield football quiz',
    intro: 'Sixteen footballers, six of them are bombs. Tap only the players who fit the category of the day and stay away from the mines.',
  },
  '/game/imposter': {
    title: 'Imposter - Football Party Game for Friends | TopBin',
    description: 'Pass-the-phone football party game: everybody knows the player except one imposter. Give one-word clues and find out who is bluffing.',
    h1: 'Imposter - the football party game',
    intro: 'Everybody gets the same footballer, except one imposter. Give one-word clues and work out who is bluffing.',
  },
  '/game/bidding-war': {
    title: 'Bidding War - Football Auction Draft Game | TopBin',
    description: 'A €20 budget for 5 players: bid against friends or a bot in a football auction draft. One phone or online with chat.',
    h1: 'Bidding War - football auction draft',
    intro: 'Each team has €20 to bid for five players. Play on one phone, online with up to four friends, or against a bot, then compare the teams.',
  },
  '/game/blind-ranking': {
    title: 'Blind Ranking - Rank Footballers Blind | TopBin',
    description: 'Rank footballers one by one without knowing who comes next, on any topic you choose. Play online with friends and argue about the result.',
    h1: 'Blind Ranking with footballers',
    intro: 'A footballer appears and you must rank him right away. Pick any topic, play with friends online, then compare the rankings side by side.',
  },
  '/game/football-bingo': {
    title: 'Football Bingo - Daily 3x3 Footballer Grid | TopBin',
    description: 'A new football bingo grid every day: name a footballer for each pair of clubs, nationalities and titles. Nine guesses, free, no signup.',
    h1: 'Football Bingo - the daily footballer grid',
    intro: 'Fill the 3x3 grid: each field needs a footballer who played for the club, has the nationality or won the title on both axes. Nine guesses, every player once.',
  },
  '/game/hit-the-number': {
    title: 'Hit the Number - Football Stats Draft Game | TopBin',
    description: 'A target number, five footballers: draft players whose career goals, assists or market value add up to it. Play with friends on one phone, closest sum wins.',
    h1: 'Hit the Number - football stats draft',
    intro: 'A target number appears. Draft five footballers whose career goals, assists or market value add up to it, taking turns with friends. Closest sum wins.',
  },
  '/game/transfer-duel': {
    title: 'Transfer Duel - Higher or Lower Football Quiz | TopBin',
    description: 'Was the next transfer fee higher or lower? Build the longest streak in this free football higher-or-lower game.',
    h1: 'Transfer Duel - higher or lower',
    intro: 'Guess whether the next transfer fee was higher or lower than the one shown. One wrong guess ends the run.',
  },
  '/game/goal-duel': {
    title: 'Goal Duel - Higher or Lower Career Goals | TopBin',
    description: 'Who scored more career goals? Pick higher or lower and build the longest streak. Free football trivia, no signup.',
    h1: 'Goal Duel - higher or lower career goals',
    intro: 'Two footballers, one stat: career goals. Guess whether the next player scored more or fewer.',
  },
  '/game/assist-duel': {
    title: 'Assist Duel - Higher or Lower Career Assists | TopBin',
    description: 'Who has more career assists? Pick higher or lower and keep your streak alive. Free football trivia, no signup.',
    h1: 'Assist Duel - higher or lower career assists',
    intro: 'Guess whether the next footballer has more or fewer career assists than the one shown.',
  },
  '/game/market-value': {
    title: 'Market Value Duel - Higher or Lower Football Quiz | TopBin',
    description: "Whose market value is higher? Guess higher or lower for footballers' current market values. Free, no signup.",
    h1: 'Market Value Duel - higher or lower',
    intro: "Guess whether the next player's market value is higher or lower than the one shown.",
  },
  '/game/guess-the-year': {
    title: 'Guess the Year - Football Match Quiz | TopBin',
    description: 'Can you tell when this famous football match was played? Guess the year and test your football knowledge. Free, no signup.',
    h1: 'Guess the Year - famous football matches',
    intro: 'Famous football matches from the past decades. Guess the year in which each one was played.',
  },
}

/** Pages that must not show up in search results (private or useless for searchers). */
export const NOINDEX = ['/login', '/signup', '/dashboard', '/friends', '/admin']

export const normalizePath = (pathname) => (pathname.replace(/\/+$/, '') || '/')
export const seoFor = (pathname) => SEO_PAGES[normalizePath(pathname)] ?? null
export const isNoindex = (pathname) => NOINDEX.some((p) => normalizePath(pathname) === p || normalizePath(pathname).startsWith(p + '/'))
export const canonicalFor = (pathname) => SITE + (normalizePath(pathname) === '/' ? '/' : normalizePath(pathname))

/** Structured data (JSON-LD) of a page: the site itself on the home page, a free web game on every game page. */
export function jsonLdFor(pathname) {
  const path = normalizePath(pathname)
  const page = SEO_PAGES[path]
  if (!page) return null
  if (path === '/') {
    return [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: 'TopBin', url: `${SITE}/`, inLanguage: 'en' },
      { '@context': 'https://schema.org', '@type': 'Organization', name: 'TopBin', url: `${SITE}/`, logo: `${SITE}/favicon.svg`, sameAs: SOCIAL_PROFILES },
    ]
  }
  return [{ '@context': 'https://schema.org', '@type': 'WebApplication', name: page.h1, url: canonicalFor(path), description: page.description, applicationCategory: 'GameApplication', genre: 'Trivia', operatingSystem: 'Any', inLanguage: 'en', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' } }]
}
