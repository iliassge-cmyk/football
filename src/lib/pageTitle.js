import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { gameLabel } from './gameLabels'
import { OG_IMAGE, canonicalFor, isNoindex, seoFor } from './seoMeta'

const SUFFIX = 'TopBin'
const SLUG_TITLES = {
  'daily-top10': 'Daily Top 10',
  minefield: 'Minefield',
  imposter: 'Imposter',
  'bidding-war': 'Bidding War',
  'blind-ranking': 'Blind Ranking',
  'hit-the-number': 'Hit the Number',
  'football-bingo': 'Football Bingo',
  'transfer-duel': 'Transfer Duel',
  'goal-duel': 'Goal Duel',
  'assist-duel': 'Assist Duel',
  'market-value': 'Market Value Duel',
  'guess-the-year': 'Guess the Year',
}
const PAGE_TITLES = { '/dashboard': 'Dashboard', '/friends': 'Friends', '/login': 'Log in', '/signup': 'Sign up', '/legal': 'Legal & Privacy', '/admin': 'Admin' }

/** Browser-tab title for a path, so every page has its own title (tabs, history, search results). */
export function titleFor(pathname) {
  const seo = seoFor(pathname)
  if (seo) return seo.title
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  if (parts.length === 0) return 'TopBin | Football Trivia'
  if (parts[0] === 'game' && SLUG_TITLES[parts[1]]) {
    const day = parts[2] && /^\d{4}-\d{2}-\d{2}$/.test(parts[2]) ? ` - ${parts[2]}` : ''
    return `${SLUG_TITLES[parts[1]]}${day} | ${SUFFIX}`
  }
  if (parts[0] === 'leaderboard' && parts[1]) return `${gameLabel(parts[1])} Leaderboard | ${SUFFIX}`
  if (parts[0] === 'dashboard') return `Dashboard | ${SUFFIX}`
  const page = PAGE_TITLES[`/${parts[0]}`]
  return `${page ?? 'Page not found'} | ${SUFFIX}`
}

/** Sets (or creates) one <meta> tag of the head. */
function setMeta(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

/** Title, description, canonical address, link-preview tags and the robots hint of the page - kept in sync while people navigate (the build step writes the same for crawlers). */
export function applySeo(pathname) {
  const title = titleFor(pathname)
  const seo = seoFor(pathname)
  const description = seo?.description ?? 'Free football trivia games: Daily Top 10, Minefield, Bidding War, Blind Ranking and more.'
  const url = canonicalFor(pathname)
  document.title = title
  setMeta('name', 'description', description)
  setMeta('property', 'og:title', title)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:url', url)
  setMeta('property', 'og:image', OG_IMAGE)
  setMeta('name', 'twitter:card', 'summary_large_image')
  setMeta('name', 'twitter:title', title)
  setMeta('name', 'twitter:description', description)
  setMeta('name', 'twitter:image', OG_IMAGE)
  setMeta('name', 'robots', isNoindex(pathname) ? 'noindex, nofollow' : 'index, follow')
  let link = document.head.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', url)
}

export function usePageTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    applySeo(pathname)
  }, [pathname])
}
