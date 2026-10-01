import { Bomb, CalendarBlank, Coins, Gavel, NotePencil, Skull, SoccerBall, Target, Trophy } from '@phosphor-icons/react'
import GameCard from '../components/GameCard'
import ComingSoonTile from '../components/ComingSoonTile'

const RANKED_GAMES = [
  {
    to: '/game/daily-top10',
    name: 'Daily Top 10',
    tagline: 'Name all 10. One ranked shot a day.',
    icon: <Trophy weight="fill" size={32} />,
    badge: 'Ranked · Daily',
    ranked: true,
  },
  {
    to: '/game/minefield',
    name: 'Minefield',
    tagline: '10 safe tiles, 6 mines. New category daily.',
    icon: <Bomb weight="fill" size={32} />,
    badge: 'Ranked · Daily',
    ranked: true,
  },
]

const MULTIPLAYER_GAMES = [
  {
    to: '/game/imposter',
    name: 'Imposter',
    tagline: 'Pass-the-phone party game. One of you doesn’t know the player.',
    icon: <Skull weight="fill" size={32} />,
    badge: 'New',
  },
  {
    to: '/game/bidding-war',
    name: 'Bidding War',
    tagline: 'Pass-the-phone auction draft. Budget, bids, bragging rights.',
    icon: <Gavel weight="fill" size={32} />,
    badge: 'New',
  },
]

const CLASSIC_GAMES = [
  { to: '/game/transfer-duel', name: 'Transfer Duel', tagline: 'Higher or lower - transfer fee.', icon: <NotePencil weight="fill" size={32} /> },
  { to: '/game/goal-duel', name: 'Goal Duel', tagline: 'Higher or lower - career goals.', icon: <SoccerBall weight="fill" size={32} /> },
  { to: '/game/assist-duel', name: 'Assist Duel', tagline: 'Higher or lower - career assists.', icon: <Target weight="fill" size={32} /> },
  { to: '/game/market-value', name: 'Market Value Duel', tagline: 'Higher or lower - market value.', icon: <Coins weight="fill" size={32} /> },
  { to: '/game/guess-the-year', name: 'Guess the Year', tagline: 'When did this match happen?', icon: <CalendarBlank weight="fill" size={32} /> },
]

function GameSection({ title, description, games, trailing }) {
  return (
    <section className="mb-10">
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold text-white">{title}</h2>
        <p className="text-sm text-white/50">{description}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map((g) => (
          <GameCard key={g.to} {...g} />
        ))}
        {trailing}
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <div>
      <div className="text-center mb-10 mt-4">
        <h1 className="font-display text-5xl sm:text-6xl font-extrabold text-white">
          Top<span className="text-orange-glow">Bin</span>
        </h1>
        <p className="mt-3 text-white/60 max-w-md mx-auto">
          Nine football trivia games. Play endlessly, climb the leaderboard, challenge your friends.
        </p>
      </div>

      <GameSection
        title="Ranked"
        description="One attempt a day. Climb the leaderboard."
        games={RANKED_GAMES}
      />

      <GameSection
        title="Multiplayer"
        description="Pass the phone around. No leaderboard, just bragging rights."
        games={MULTIPLAYER_GAMES}
      />

      <GameSection
        title="Classics"
        description="Play as often as you like."
        games={CLASSIC_GAMES}
        trailing={<ComingSoonTile />}
      />
    </div>
  )
}
