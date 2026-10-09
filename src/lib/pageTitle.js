import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { gameLabel } from './gameLabels'

const SUFFIX = 'TopBin'
const SLUG_TITLES = {
  'daily-top10': 'Daily Top 10',
  minefield: 'Minefield',
  imposter: 'Imposter',
  'bidding-war': 'Bidding War',
  'transfer-duel': 'Transfer Duel',
  'goal-duel': 'Goal Duel',
  'assist-duel': 'Assist Duel',
  'market-value': 'Market Value Duel',
  'guess-the-year': 'Guess the Year',
}
const PAGE_TITLES = { '/dashboard': 'Dashboard', '/friends': 'Friends', '/login': 'Log in', '/signup': 'Sign up', '/legal': 'Legal & Privacy', '/admin': 'Admin' }

/** Browser-tab title for a path, so every page has its own title (tabs, history, search results). */
export function titleFor(pathname) {
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

export function usePageTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = titleFor(pathname)
  }, [pathname])
}
