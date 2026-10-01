import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Flame, Snowflake } from '@phosphor-icons/react'
import { useAuth } from '../lib/AuthContext'
import { isBackendConfigured, supabase } from '../lib/supabaseClient'
import { getDashboardStats } from '../lib/dashboardStats'
import { deleteAccount } from '../lib/auth'
import { isFriend } from '../lib/friends'
import { computeBadges } from '../lib/badges'
import Badges from '../components/Badges'
import StreakFreezePopup from '../components/StreakFreezePopup'
import { useNoIndex } from '../lib/useNoIndex'

const DUEL_LABELS = {
  goal_duel: 'Goal Duel',
  market_value_duel: 'Market Value Duel',
  assist_duel: 'Assist Duel',
  transfer_duel: 'Transfer Duel',
}

export default function Dashboard() {
  useNoIndex()
  const { userId: viewedUserId } = useParams()
  const { user, profile: myProfile, loading: authLoading } = useAuth()
  const [stats, setStats] = useState(null)
  const [viewedProfile, setViewedProfile] = useState(null)
  const [allowed, setAllowed] = useState(true)
  const [loading, setLoading] = useState(true)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()

  const isOwnDashboard = !viewedUserId || viewedUserId === user?.id

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      await deleteAccount()
      navigate('/')
    } catch {
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    async function load() {
      if (!isOwnDashboard) {
        const friend = await isFriend(viewedUserId)
        if (!friend) {
          setAllowed(false)
          return
        }
        const { data } = await supabase.from('profiles').select('id, username, created_at').eq('id', viewedUserId).maybeSingle()
        setViewedProfile(data)
      }
      setAllowed(true)
      setStats(await getDashboardStats(isOwnDashboard ? undefined : viewedUserId))
    }
    load().finally(() => setLoading(false))
  }, [user, viewedUserId, isOwnDashboard])

  if (!isBackendConfigured) return <p className="text-white/60">Dashboard needs a connected Supabase project.</p>
  if (authLoading || loading) return <p className="text-white/60">Loading…</p>
  if (!user) return <p className="text-white/60">Log in to see your dashboard.</p>
  if (!allowed) {
    return (
      <div>
        <p className="text-white/60">You can only view dashboards of your accepted friends.</p>
        <Link to="/friends" className="mt-2 inline-block text-orange-glow underline underline-offset-2 text-sm">
          Back to Friends
        </Link>
      </div>
    )
  }

  const daily = stats?.dailyTop10
  const rank = stats?.globalDailyRank
  const minefield = stats?.minefield
  const minefieldRank = stats?.globalMinefieldRank
  const profileForBadges = isOwnDashboard ? myProfile : viewedProfile
  const { special, categories } = computeBadges(stats, profileForBadges)

  return (
    <div className="mx-auto max-w-4xl">
      {isOwnDashboard && <StreakFreezePopup />}

      {isOwnDashboard ? (
        <h1 className="font-display text-3xl font-bold text-white mb-6">Dashboard</h1>
      ) : (
        <div className="mb-6">
          <Link to="/friends" className="text-xs text-white/50 hover:text-white underline underline-offset-2">
            ← Back to Friends
          </Link>
          <h1 className="font-display text-3xl font-bold text-white mt-1">{viewedProfile?.username}'s Dashboard</h1>
        </div>
      )}

      {/* Hero KPIs - the two ranked daily modes (6.2 + later request to give Minefield equal billing) */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Link
          to="/leaderboard/daily_top10"
          className="glass-card block rounded-3xl p-6 hover:border-amber-glow/40 transition-colors"
        >
          <p className="text-xs uppercase tracking-wide text-amber-glow font-semibold">Daily Top 10 · Ranked</p>
          <p className="mt-2 font-display text-4xl font-extrabold text-white">
            {rank ? `#${rank.rank} of ${rank.of}` : 'Unranked'}
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-white/70 text-sm">
            <span>{rank?.totalPoints ?? 0} pts</span>
            <span className="inline-flex items-center gap-1">
              <Flame weight="fill" className="text-amber-glow" /> {daily?.currentStreak ?? 0}-day streak
              {daily?.perfectCount > 0 && <span className="text-white/50">({daily.perfectCount})</span>}
            </span>
          </div>
        </Link>

        <Link
          to="/leaderboard/minefield"
          className="glass-card block rounded-3xl p-6 hover:border-orange-glow/40 transition-colors"
        >
          <p className="text-xs uppercase tracking-wide text-orange-glow font-semibold">Minefield · Ranked</p>
          <p className="mt-2 font-display text-4xl font-extrabold text-white">
            {minefieldRank ? `#${minefieldRank.rank} of ${minefieldRank.of}` : 'Unranked'}
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-white/70 text-sm">
            <span>{minefieldRank?.totalPoints ?? 0} pts</span>
            <span className="inline-flex items-center gap-1">
              <Flame weight="fill" className="text-orange-glow" /> {minefield?.currentStreak ?? 0}-day streak
            </span>
          </div>
        </Link>
      </div>

      <div className="mb-6">
        <Badges special={special} categories={categories} />
      </div>

      {/* Compact duel KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Object.entries(DUEL_LABELS).map(([key, label]) => {
          const r = stats?.duelRanks?.[key]
          return (
            <div key={key} className="glass-card rounded-xl p-4">
              <p className="text-xs text-white/50">{label}</p>
              <p className="mt-1 font-display text-2xl font-bold text-white">{r?.score ?? 0}</p>
              <p className="text-xs text-white/40">{r ? `Rank #${r.rank} of ${r.of}` : 'Unranked'}</p>
            </div>
          )
        })}
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-white/50">Guess the Year</p>
          <p className="mt-1 font-display text-2xl font-bold text-white">{stats?.duelRanks?.guess_the_year?.score ?? 0}</p>
          <p className="text-xs text-white/40">
            {stats?.duelRanks?.guess_the_year ? `Rank #${stats.duelRanks.guess_the_year.rank} of ${stats.duelRanks.guess_the_year.of}` : 'Unranked'}
          </p>
        </div>
      </div>

      {/* Daily Top 10 detail */}
      <div className="glass-card rounded-2xl p-5 mb-6">
        <h2 className="font-display text-lg font-semibold text-white mb-3">Daily Top 10 - Details</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Stat
            label="Longest streak"
            value={
              <span className="inline-flex items-center gap-1">
                <Flame weight="fill" className="text-amber-glow" /> {daily?.longestStreak ?? 0}
              </span>
            }
          />
          <Stat label="Ranked days played" value={daily?.rankedDaysPlayed ?? 0} />
          <Stat label="Ranked days won" value={daily?.rankedDaysWon ?? 0} />
          <Stat label="Success rate" value={`${daily?.successRate ?? 0}%`} />
          {isOwnDashboard && (
            <Stat
              label="Freezes banked"
              value={
                <span className="inline-flex items-center gap-1">
                  <Snowflake weight="fill" className="text-sky-300" /> {stats?.freezeBalance ?? 0}/3
                </span>
              }
            />
          )}
        </div>
        <p className="mt-3 text-xs text-white/40">
          {daily?.practiceAttempts ?? 0} practice attempts on past days (unranked, not counted above)
          {isOwnDashboard && ' - earn a freeze with a perfect 10/10 day, spend it to save a streak that would otherwise break.'}
        </p>
      </div>

      {/* Minefield detail */}
      <div className="glass-card rounded-2xl p-5 mb-6">
        <h2 className="font-display text-lg font-semibold text-white mb-3">Minefield - Details</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Stat
            label="Longest streak"
            value={
              <span className="inline-flex items-center gap-1">
                <Flame weight="fill" className="text-orange-glow" /> {minefield?.longestStreak ?? 0}
              </span>
            }
          />
          <Stat label="Ranked days played" value={minefield?.rankedDaysPlayed ?? 0} />
          <Stat label="Ranked days cleared" value={minefield?.rankedDaysWon ?? 0} />
          <Stat label="Success rate" value={`${minefield?.successRate ?? 0}%`} />
        </div>
        <p className="mt-3 text-xs text-white/40">
          {minefield?.practiceAttempts ?? 0} practice attempts on past days (unranked, not counted above)
        </p>
      </div>

      {/* Overall */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="font-display text-lg font-semibold text-white mb-3">Overall</h2>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Total rounds played" value={stats?.totalRounds ?? 0} />
          <Stat label="Most played game" value={stats?.mostPlayed ?? '-'} />
        </div>
      </div>

      {isOwnDashboard && (
        <div className="glass-card rounded-2xl p-5 mt-6 border-red-500/20">
          <h2 className="font-display text-lg font-semibold text-white mb-2">Account</h2>
          <p className="text-sm text-white/50 mb-3">
            Signed in as <span className="text-white">{myProfile?.username}</span>
          </p>
          {!confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/25 transition"
            >
              Delete Account
            </button>
          ) : (
            <div className="text-sm">
              <p className="text-red-400 mb-2">
                This permanently deletes your profile, friendships, highscores and Daily Top 10 history. This
                cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  disabled={deleting}
                  onClick={handleDeleteAccount}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 transition disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Yes, delete my account'}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-white/50 text-xs">{label}</p>
      <p className="font-display text-lg font-bold text-white">{value}</p>
    </div>
  )
}
