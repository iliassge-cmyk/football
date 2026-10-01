import { useEffect, useState } from 'react'
import { Snowflake, X } from '@phosphor-icons/react'
import { supabase } from '../lib/supabaseClient'
import { getStreak, getMyFreezeBalance, isPendingBreakActive, spendFreeze } from '../lib/streaks'

const GAME_LABELS = { daily_top10: 'Daily Top 10', minefield: 'Minefield' }
const ALL_GAMES = ['daily_top10', 'minefield']

/**
 * Checks whether the signed-in user's own streak - Daily Top 10 and/or
 * Minefield, or just `game` if given - is one bad result away from breaking
 * (and still inside its 24h save window) and, if so and they have a freeze
 * banked, offers to spend one to save it. The two games share one freeze
 * balance, so this checks both unless told to focus on one. Renders nothing
 * otherwise - safe to mount unconditionally on any page.
 */
export default function StreakFreezePopup({ game }) {
  const [offer, setOffer] = useState(null) // { game, streak, freezes } | null
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (!supabase) return
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const freezes = await getMyFreezeBalance()
      if (cancelled || freezes < 1) return

      for (const g of game ? [game] : ALL_GAMES) {
        const streak = await getStreak(user.id, g)
        if (cancelled) return
        if (isPendingBreakActive(streak.pending_break_at)) {
          setOffer({ game: g, streak: streak.current_streak, freezes })
          return
        }
      }
    }
    check().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [game])

  async function useFreeze() {
    setBusy(true)
    try {
      await spendFreeze(offer.game)
    } catch {
      // best-effort - worst case the streak just breaks as it normally would
    } finally {
      setBusy(false)
      setDismissed(true)
    }
  }

  if (!offer || dismissed) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card relative max-w-sm w-full rounded-2xl p-6 text-center">
        <button
          onClick={() => setDismissed(true)}
          aria-label="Close"
          className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors"
        >
          <X size={20} weight="bold" />
        </button>
        <Snowflake size={36} weight="fill" className="mx-auto text-sky-300 mb-3" />
        <h3 className="font-display text-xl font-bold text-white mb-2">Your streak is about to break!</h3>
        <p className="text-sm text-white/70 mb-5">
          You're on a {offer.streak}-day {GAME_LABELS[offer.game]} streak. Spend a freeze to keep it alive - you have{' '}
          {offer.freezes} left.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setDismissed(true)}
            className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition"
          >
            Let it break
          </button>
          <button
            disabled={busy}
            onClick={useFreeze}
            className="flex-1 rounded-xl bg-orange-glow px-4 py-2.5 text-sm font-bold text-ink-950 hover:brightness-110 transition disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Use a freeze'}
          </button>
        </div>
      </div>
    </div>
  )
}
