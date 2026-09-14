import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isBackendConfigured } from '../lib/supabaseClient'
import { useNoIndex } from '../lib/useNoIndex'
import FriendSearch from '../components/FriendSearch'
import { listFriendState, acceptFriendRequest, removeFriendship } from '../lib/friends'

export default function Friends() {
  useNoIndex()
  const { user } = useAuth()
  const [state, setState] = useState({ friends: [], incoming: [], outgoing: [] })
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      setState(await listFriendState())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) refresh()
    else setLoading(false)
  }, [user])

  if (!isBackendConfigured) {
    return <p className="text-white/60">Friends need a connected Supabase project.</p>
  }
  if (!user) {
    return <p className="text-white/60">Log in to add friends and compare scores.</p>
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-white mb-4">Friends</h1>
        <FriendSearch
          onRequestSent={refresh}
          existingIds={[...state.friends, ...state.outgoing].map((f) => f.id)}
        />
      </div>

      {state.incoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-2">Requests</h2>
          <ul className="space-y-2">
            {state.incoming.map((f) => (
              <li key={f.friendshipId} className="glass-card flex items-center justify-between rounded-xl px-4 py-2.5">
                <span className="text-white">{f.username}</span>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await acceptFriendRequest(f.friendshipId)
                      refresh()
                    }}
                    className="rounded-lg bg-emerald-glow px-3 py-1.5 text-xs font-semibold text-ink-950 hover:brightness-110 transition"
                  >
                    Accept
                  </button>
                  <button
                    onClick={async () => {
                      await removeFriendship(f.friendshipId)
                      refresh()
                    }}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-2">
          Your Friends {loading ? '' : `(${state.friends.length})`}
        </h2>
        {loading ? (
          <p className="text-white/50 text-sm">Loading…</p>
        ) : state.friends.length === 0 ? (
          <p className="text-white/50 text-sm">No friends yet — search above to add some.</p>
        ) : (
          <ul className="space-y-2">
            {state.friends.map((f) => (
              <li key={f.friendshipId} className="glass-card flex items-center justify-between rounded-xl px-4 py-2.5">
                <span className="text-white">{f.username}</span>
                <button
                  onClick={async () => {
                    await removeFriendship(f.friendshipId)
                    refresh()
                  }}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-red-500/20 hover:text-red-400 transition"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {state.outgoing.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-2">Pending Sent</h2>
          <ul className="space-y-2">
            {state.outgoing.map((f) => (
              <li key={f.friendshipId} className="glass-card flex items-center justify-between rounded-xl px-4 py-2.5">
                <span className="text-white/70">{f.username}</span>
                <span className="text-xs text-white/40">Requested</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
