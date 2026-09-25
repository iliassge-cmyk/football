import { Bomb, CalendarBlank, Coins, NotePencil, SoccerBall, Target, Trophy } from '@phosphor-icons/react'
import GameCard from '../components/GameCard'
import ComingSoonTile from '../components/ComingSoonTile'

const GAMES = [
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
  { to: '/game/transfer-duel', name: 'Transfer Duel', tagline: 'Higher or lower — transfer fee.', icon: <NotePencil weight="fill" size={32} /> },
  { to: '/game/goal-duel', name: 'Goal Duel', tagline: 'Higher or lower — career goals.', icon: <SoccerBall weight="fill" size={32} /> },
  { to: '/game/assist-duel', name: 'Assist Duel', tagline: 'Higher or lower — career assists.', icon: <Target weight="fill" size={32} /> },
  { to: '/game/market-value', name: 'Market Value Duel', tagline: 'Higher or lower — market value.', icon: <Coins weight="fill" size={32} /> },
  { to: '/game/guess-the-year', name: 'Guess the Year', tagline: 'When did this match happen?', icon: <CalendarBlank weight="fill" size={32} /> },
]

export default function Home() {
  return (
    <div>
      <div className="text-center mb-10 mt-4">
        <h1 className="font-display text-5xl sm:text-6xl font-extrabold text-white">
          Top<span className="text-orange-glow">Bin</span>
        </h1>
        <p className="mt-3 text-white/60 max-w-md mx-auto">
          Seven football trivia games. Play endlessly, climb the leaderboard, challenge your friends.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {GAMES.map((g) => (
          <GameCard key={g.to} {...g} />
        ))}
        <ComingSoonTile />
      </div>
    </div>
  )
}
