import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Flame } from '@phosphor-icons/react'
import { useAuth } from '../lib/AuthContext'
import { isBackendConfigured } from '../lib/supabaseClient'
import LeaderboardTable from '../components/LeaderboardTable'
import { getDuelLeaderboard, getStreakLeaderboard } from '../lib/leaderboard'
import { GAME_LABELS } from '../lib/gameLabels'

const DATED_MODES = new Set(['daily_top10', 'minefield'])

const streakCell = (value, perfect) =>
  value > 0 ? (
    <span className="inline-flex items-center gap-1 text-amber-glow">
      <Flame weight="fill" /> {value}
      {perfect > 0 && <span className="text-white/50">({perfect})</span>}
    </span>
  ) : (
    '-'
  )

export default function Leaderboard() {
  const { game } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [friendsOnly, setFriendsOnly] = useState(false)
  const [tab, setTab] = useState('current') // for dated modes: 'current' | 'longest'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const label = GAME_LABELS[game] ?? game
  const isDated = DATED_MODES.has(game)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = isDated
          ? await getStreakLeaderboard(game, { friendsOnly, sortBy: tab })
          : await getDuelLeaderboard(game, { friendsOnly })
        if (!cancelled) setRows(data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [game, friendsOnly, tab, isDated])

  const datedColumns =
    tab === 'longest'
      ? [
          { key: 'longestStreak', label: 'Longest streak', render: (r) => streakCell(r.longestStreak) },
          { key: 'currentStreak', label: 'Current', render: (r) => streakCell(r.currentStreak) },
        ]
      : [
          { key: 'currentStreak', label: 'Current streak', render: (r) => streakCell(r.currentStreak, r.perfectCount) },
          { key: 'longestStreak', label: 'Longest', render: (r) => streakCell(r.longestStreak) },
        ]

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">{label}</h1>
          <p className="text-sm text-white/50">
            Global leaderboard {isDated && <span className="text-orange-glow font-semibold">· Ranked</span>}
          </p>
        </div>
        <select
          value={game}
          onChange={(e) => navigate(`/leaderboard/${e.target.value}`)}
          className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white"
        >
          {Object.entries(GAME_LABELS).map(([key, name]) => (
            <option key={key} value={key} className="bg-ink-900">
              {name}
            </option>
          ))}
        </select>
      </div>

      {isDated && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setTab('current')}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === 'current' ? 'bg-orange-glow text-ink-950' : 'bg-white/10 text-white/70'}`}
          >
            Current streak
          </button>
          <button
            onClick={() => setTab('longest')}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === 'longest' ? 'bg-orange-glow text-ink-950' : 'bg-white/10 text-white/70'}`}
          >
            Longest streak
          </button>
        </div>
      )}

      <p className="mb-4 text-xs text-white/40">
        {isDated
          ? 'Days in a row you played the daily challenge. The number in brackets is how many of those days were perfect.'
          : 'Your record is your best run: the most right answers in a row in a single round. Every new round starts at zero.'}
      </p>

      <label className="mb-4 flex items-center gap-2 text-sm text-white/70">
        <input
          type="checkbox"
          disabled={!user}
          checked={friendsOnly}
          onChange={(e) => setFriendsOnly(e.target.checked)}
          className="accent-orange-glow"
        />
        Friends only
        {!user && <span className="text-white/40">(log in to use this)</span>}
      </label>

      {!isBackendConfigured ? (
        <p className="text-white/60 text-sm py-6 text-center">Leaderboards need a connected Supabase project.</p>
      ) : loading ? (
        <p className="text-white/60 text-sm py-6 text-center">Loading…</p>
      ) : isDated ? (
        <LeaderboardTable rows={rows} columns={datedColumns} emptyLabel="No streaks yet." />
      ) : (
        <LeaderboardTable
          rows={rows}
          columns={[{ key: 'streak', label: 'Best streak', render: (r) => streakCell(r.streak) }]}
          emptyLabel="No runs yet."
        />
      )}
    </div>
  )
}
