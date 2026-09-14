import { useState } from 'react'
import { searchUsers, sendFriendRequest } from '../lib/friends'

export default function FriendSearch({ onRequestSent, existingIds = [] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [sentTo, setSentTo] = useState(new Set())
  const [error, setError] = useState('')

  async function handleSearch(e) {
    e.preventDefault()
    setError('')
    try {
      const found = await searchUsers(query)
      setResults(found)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAdd(user) {
    try {
      await sendFriendRequest(user.id)
      setSentTo((s) => new Set(s).add(user.id))
      onRequestSent?.()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username…"
          className="flex-1 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-glow"
        />
        <button type="submit" className="rounded-xl bg-emerald-glow px-4 py-2.5 text-sm font-semibold text-ink-950 hover:brightness-110 transition">
          Search
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-3 space-y-2">
          {results.map((u) => {
            const alreadySent = sentTo.has(u.id) || existingIds.includes(u.id)
            return (
              <li key={u.id} className="glass-card flex items-center justify-between rounded-xl px-4 py-2.5">
                <span className="text-white">{u.username}</span>
                <button
                  disabled={alreadySent}
                  onClick={() => handleAdd(u)}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition disabled:opacity-40"
                >
                  {alreadySent ? 'Requested' : 'Add Friend'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
