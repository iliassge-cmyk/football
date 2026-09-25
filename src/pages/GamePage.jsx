import { useParams, Navigate } from 'react-router-dom'
import HigherLowerGame from '../components/HigherLowerGame'
import PlayerIdentity from '../components/PlayerIdentity'
import GuessTheYear from '../components/GuessTheYear'
import players from '../data/players.json'
import transfers from '../data/transfers.json'

const eur = (n) => `€${(n / 1_000_000).toFixed(2)}M`
const wholeNumber = (label) => (n) => `${Math.round(n).toLocaleString('en-US')} ${label}`

// players.json's `position` is free text, not a strict enum (mixes "GK",
// "Keeper", "Goalkeeper", lowercase variants, ...) - match loosely rather
// than by exact string so this doesn't silently miss half the keepers.
const isGoalkeeper = (p) => /keeper|goalkeeper|\bgk\b/i.test(p.position || '')

const DUEL_CONFIGS = {
  'goal-duel': {
    gameType: 'goal_duel',
    title: 'Goal Duel',
    // Goalkeepers excluded: near-universally 0 career goals, making every
    // duel against one a non-contest rather than a real trivia question.
    dataset: players.filter((p) => Number.isFinite(p.career_goals) && !isGoalkeeper(p)),
    attribute: 'career_goals',
    formatValue: wholeNumber('goals'),
    renderIdentity: (p) => <PlayerIdentity name={p.name} club={p.club} crestUrl={p.club_crest_url} />,
  },
  'market-value': {
    gameType: 'market_value_duel',
    title: 'Market Value Duel',
    hint: 'Market value estimate, as of Summer 2026',
    dataset: players.filter((p) => Number.isFinite(p.market_value_eur) && p.market_value_eur > 0),
    attribute: 'market_value_eur',
    formatValue: eur,
    renderIdentity: (p) => <PlayerIdentity name={p.name} club={p.club} crestUrl={p.club_crest_url} />,
  },
  'assist-duel': {
    gameType: 'assist_duel',
    title: 'Assist Duel',
    // Goalkeepers excluded: near-universally 0 career assists, making every
    // duel against one a non-contest rather than a real trivia question.
    dataset: players.filter((p) => Number.isFinite(p.career_assists) && !isGoalkeeper(p)),
    attribute: 'career_assists',
    formatValue: wholeNumber('assists'),
    renderIdentity: (p) => <PlayerIdentity name={p.name} club={p.club} crestUrl={p.club_crest_url} />,
  },
  'transfer-duel': {
    gameType: 'transfer_duel',
    title: 'Transfer Duel',
    dataset: transfers.filter((t) => Number.isFinite(t.fee_eur)),
    attribute: 'fee_eur',
    formatValue: eur,
    renderIdentity: (t) => (
      <div className="text-center">
        <p className="font-display text-lg font-semibold text-white leading-tight">{t.player_name}</p>
        <p className="mt-1 text-sm text-white/60">
          {t.from_club} → {t.to_club}
        </p>
        <p className="text-xs text-white/40">{t.year}</p>
      </div>
    ),
  },
}

export default function GamePage() {
  const { slug } = useParams()

  if (slug === 'guess-the-year') return <GuessTheYear />

  const config = DUEL_CONFIGS[slug]
  if (!config) return <Navigate to="/" replace />

  return <HigherLowerGame {...config} />
}
