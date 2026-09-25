import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Flame } from '@phosphor-icons/react'
import { useAuth } from '../lib/AuthContext'
import { isBackendConfigured } from '../lib/supabaseClient'
import LeaderboardTable from '../components/LeaderboardTable'
import {
  getDuelLeaderboard,
  getDailyTop10Month,
  getDailyTop10AllTime,
  getMinefieldMonth,
  getMinefieldAllTime,
} from '../lib/leaderboard'

const GAME_LABELS = {
  daily_top10: 'Daily Top 10',
  minefield: 'Minefield',
  goal_duel: 'Goal Duel',
  market_value_duel: 'Market Value Duel',
  assist_duel: 'Assist Duel',
  transfer_duel: 'Transfer Duel',
  guess_the_year: 'Guess the Year',
}

const VALUE_COLUMN = {
  goal_duel: { key: 'score', label: 'Highscore' },
  market_value_duel: { key: 'score', label: 'Highscore' },
  assist_duel: { key: 'score', label: 'Highscore' },
  transfer_duel: { key: 'score', label: 'Highscore' },
  guess_the_year: { key: 'score', label: 'Highscore' },
}

const DATED_MODES = new Set(['daily_top10', 'minefield'])

export default function Leaderboard() {
  const { game } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [friendsOnly, setFriendsOnly] = useState(false)
  const [tab, setTab] = useState('alltime') // for dated modes: 'month' | 'alltime'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const label = GAME_LABELS[game] ?? game
  const isDated = DATED_MODES.has(game)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        let data = []
        if (game === 'daily_top10') {
          data = tab === 'month' ? await getDailyTop10Month({ friendsOnly }) : await getDailyTop10AllTime({ friendsOnly })
        } else if (game === 'minefield') {
          data = tab === 'month' ? await getMinefieldMonth({ friendsOnly }) : await getMinefieldAllTime({ friendsOnly })
        } else {
          data = await getDuelLeaderboard(game, { friendsOnly })
        }
        if (!cancelled) setRows(data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [game, friendsOnly, tab])

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
            onClick={() => setTab('month')}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === 'month' ? 'bg-orange-glow text-ink-950' : 'bg-white/10 text-white/70'}`}
          >
            Month
          </button>
          <button
            onClick={() => setTab('alltime')}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === 'alltime' ? 'bg-orange-glow text-ink-950' : 'bg-white/10 text-white/70'}`}
          >
            All-Time
          </button>
        </div>
      )}

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
        <LeaderboardTable
          rows={rows}
          columns={[
            { key: 'totalPoints', label: 'Points' },
            {
              key: 'streak',
              label: 'Streak',
              render: (r) =>
                r.streak > 0 ? (
                  <span className="inline-flex items-center gap-1 text-amber-glow">
                    <Flame weight="fill" /> {r.streak}
                  </span>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      ) : (
        <LeaderboardTable rows={rows} columns={[VALUE_COLUMN[game] ?? { key: 'score', label: 'Score' }]} />
      )}
    </div>
  )
}
