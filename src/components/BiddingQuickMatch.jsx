import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { tabId } from '../lib/bwIdentity'

const SUGGEST_BOT_AFTER_MS = 8000

/**
 * Quick match: everybody who is searching shows up in one shared lobby; the two who have been waiting longest get paired.
 * Both devices work out the same pairing from the same list, so there is no server logic - the older one becomes the host.
 * onMatched({ code, role, partner })   onBot()   onCancel()
 * `ignore`: partner ids that did not show up before (stale entries) - they are skipped.
 */
export default function BiddingQuickMatch({ playerName, ignore = [], onMatched, onBot, onCancel, channel = 'bw-lobby', botLabel = 'Play vs Bot instead', slowText = 'Nobody is online right now. We keep looking - or play the bot meanwhile.', waitText = 'Looking for an opponent' }) {
  const [slow, setSlow] = useState(false)
  const matched = useRef(false)

  useEffect(() => {
    if (!supabase) return undefined
    const myId = tabId()
    const joinedAt = Date.now()
    let ch = null
    const check = () => {
      if (matched.current) return
      const list = Object.entries(ch.presenceState())
        .filter(([key]) => key === myId || !ignore.includes(key))
        .map(([key, metas]) => ({ key, t: metas[0]?.t ?? 0 }))
        .sort((a, b) => a.t - b.t || a.key.localeCompare(b.key))
      const i = list.findIndex((x) => x.key === myId)
      if (i < 0) return
      const partner = i % 2 === 0 ? list[i + 1] : list[i - 1]
      if (!partner) return
      matched.current = true
      const code = 'Q' + [myId, partner.key].sort().join('').replace(/[^a-z0-9]/gi, '').slice(0, 11).toUpperCase()
      onMatched({ code, role: i % 2 === 0 ? 'host' : 'guest', partner: partner.key })
    }
    // joining a moment later keeps a quick unmount/mount (React development mode) from tearing down the fresh subscription of the same topic
    const startId = setTimeout(() => {
      ch = supabase.channel(channel, { config: { presence: { key: myId } } })
      ch.on('presence', { event: 'sync' }, check)
      ch.subscribe((status) => { if (status === 'SUBSCRIBED') ch.track({ t: joinedAt, name: playerName }) })
    }, 120)
    const id = setTimeout(() => setSlow(true), SUGGEST_BOT_AFTER_MS)
    return () => {
      clearTimeout(startId)
      clearTimeout(id)
      // after a match the lobby presence stays a few seconds, so the partner still sees us when his update arrives (a join that is gone again
      // within milliseconds can be skipped by the other device)
      const old = ch
      if (old) setTimeout(() => supabase.removeChannel(old), matched.current ? 5000 : 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto max-w-sm pt-10 text-center">
      <h2 className="font-display text-2xl font-bold text-white mb-1">Quick match</h2>
      <p className="text-white/70 text-lg mt-6 mb-2">
        <span className="mr-2 inline-flex gap-1 align-middle" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-glow" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-glow [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-glow [animation-delay:300ms]" />
        </span>
        {waitText}
      </p>
      {slow && (
        <div className="mt-6">
          <p className="text-sm text-white/55 mb-3">{slowText}</p>
          <button onClick={onBot} className="w-full rounded-2xl bg-orange-glow px-4 py-4 text-base font-bold text-ink-950 hover:brightness-110 active:scale-[0.99] transition">
            {botLabel}
          </button>
        </div>
      )}
      <button onClick={onCancel} className="mt-8 text-sm text-white/40 hover:text-white/70 transition">Cancel</button>
    </div>
  )
}
