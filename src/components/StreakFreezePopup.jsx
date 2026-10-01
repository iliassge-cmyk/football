import { useEffect, useState } from 'react'
import { Snowflake, X } from '@phosphor-icons/react'
import { supabase } from '../lib/supabaseClient'
import { getDailyTop10Streak, getMyFreezeBalance, isPendingBreakActive, spendFreeze } from '../lib/streaks'

// Only Daily Top 10 has the hold/break banding that can leave a streak
// "pending" - Minefield's streak can't currently enter this state.
const GAME = 'daily_top10'

/**
 * Checks whether the signed-in user's own Daily Top 10 streak is one bad day
 * away from breaking (and still inside its 24h save window) and, if so and
 * they have a freeze banked, offers to spend one to save it. Renders nothing
 * otherwise - safe to mount unconditionally on any page.
 */
export default function StreakFreezePopup() {
  const [offer, setOffer] = useState(null) // { streak, freezes } | null
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

      const streak = await getDailyTop10Streak(user.id)
      if (cancelled || !isPendingBreakActive(streak.pending_break_at)) return

      const freezes = await getMyFreezeBalance()
      if (cancelled || freezes < 1) return

      setOffer({ streak: streak.current_streak, freezes })
    }
    check().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function useFreeze() {
    setBusy(true)
    try {
      await spendFreeze(GAME)
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
          You're on a {offer.streak}-day Daily Top 10 streak. Spend a freeze to keep it alive - you have {offer.freezes}{' '}
          left.
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
