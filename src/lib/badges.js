// Badges are computed entirely from data the dashboard already fetches
// (getDashboardStats() + the profile's created_at) - no separate table, no
// extra queries. Each tiered category shows only its highest earned tier
// plus progress toward the next one, so the UI stays a handful of cards
// instead of a wall of near-duplicate medals.

export const TIERS = ['bronze', 'silver', 'gold', 'platinum']

export const TIER_STYLE = {
  bronze: { label: 'Bronze', color: '#cd7f32', glow: 'rgba(205,127,50,0.45)' },
  silver: { label: 'Silver', color: '#d7dbe0', glow: 'rgba(215,219,224,0.45)' },
  gold: { label: 'Gold', color: '#f5b942', glow: 'rgba(245,185,66,0.5)' },
  platinum: { label: 'Platinum', color: '#7dd3fc', glow: 'rgba(125,211,252,0.55)' },
}

const FOUNDER_CUTOFF = new Date('2026-11-01T00:00:00Z')

/** Longest run (most right answers in a row in one round) across the Higher/Lower duels and Guess the Year. */
function bestRunStreak(stats) {
  return Math.max(0, ...Object.values(stats?.duelRanks ?? {}).map((r) => r?.streak ?? 0))
}

// `unit` finishes the sentence "<threshold> <unit>" in the how-to-earn list ("5 right answers in a row").
const CATEGORIES = [
  {
    id: 'duel-streaks',
    label: 'Hot Streak',
    description: 'Most right answers in a row in a single round of a Higher/Lower duel or Guess the Year',
    unit: 'right answers in a row',
    icon: 'Target',
    thresholds: { bronze: 5, silver: 10, gold: 20, platinum: 35 },
    value: (stats) => bestRunStreak(stats),
  },
  {
    id: 'daily-top10-wins',
    label: 'Top 10 Regular',
    description: 'Ranked Daily Top 10 days won (all 10 found)',
    unit: 'ranked days won',
    icon: 'Trophy',
    thresholds: { bronze: 5, silver: 15, gold: 30, platinum: 60 },
    value: (stats) => stats?.dailyTop10?.rankedDaysWon ?? 0,
  },
  {
    id: 'minefield-wins',
    label: 'Minefield Veteran',
    description: 'Ranked Minefield days cleared',
    unit: 'ranked days cleared',
    icon: 'ShieldCheck',
    thresholds: { bronze: 5, silver: 15, gold: 30, platinum: 60 },
    value: (stats) => stats?.minefield?.rankedDaysWon ?? 0,
  },
  {
    id: 'streak',
    label: 'On Fire',
    description: 'Longest daily streak in a ranked game (Daily Top 10 or Minefield)',
    unit: 'days in a row',
    icon: 'Fire',
    thresholds: { bronze: 3, silver: 7, gold: 14, platinum: 30 },
    value: (stats) => Math.max(stats?.dailyTop10?.longestStreak ?? 0, stats?.minefield?.longestStreak ?? 0),
  },
  {
    id: 'total-rounds',
    label: 'Marathon',
    description: 'Total rounds played across every game',
    unit: 'rounds played',
    icon: 'Sparkle',
    thresholds: { bronze: 25, silver: 100, gold: 250, platinum: 500 },
    value: (stats) => stats?.totalRounds ?? 0,
  },
]

function tierFor(value, thresholds) {
  let earned = null
  for (const tier of TIERS) {
    if (value >= thresholds[tier]) earned = tier
  }
  return earned
}

/**
 * Returns { special: [...], categories: [...] }. `special` is just Founder
 * for now (time-limited, one-off - not part of the tiered grid). Each
 * category entry: { id, label, description, unit, icon, tier, value,
 * nextTier, nextThreshold, tiers } - `tier` is null if no tier earned yet,
 * still shown "locked" so there's something visible to chase. `tiers` lists
 * every tier with its threshold and whether it is reached (for the how-to-earn popover).
 */
export function computeBadges(stats, profile) {
  const special = []
  if (profile?.created_at && new Date(profile.created_at) < FOUNDER_CUTOFF) {
    special.push({
      id: 'founder',
      label: 'Founder',
      description: 'Joined before November 2026',
      icon: 'Crown',
    })
  }

  const categories = CATEGORIES.map((cat) => {
    const value = cat.value(stats)
    const tier = tierFor(value, cat.thresholds)
    const nextTierIdx = tier ? TIERS.indexOf(tier) + 1 : 0
    const nextTier = TIERS[nextTierIdx] ?? null
    return {
      id: cat.id,
      label: cat.label,
      description: cat.description,
      unit: cat.unit,
      icon: cat.icon,
      tier,
      value,
      nextTier,
      nextThreshold: nextTier ? cat.thresholds[nextTier] : null,
      tiers: TIERS.map((t) => ({ tier: t, threshold: cat.thresholds[t], reached: value >= cat.thresholds[t] })),
    }
  })

  return { special, categories }
}
