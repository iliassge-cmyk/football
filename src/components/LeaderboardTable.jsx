import { useAuth } from '../lib/AuthContext'

export default function LeaderboardTable({ rows, columns, emptyLabel = 'No scores yet.' }) {
  const { profile } = useAuth()

  if (!rows.length) return <p className="text-white/60 text-sm py-6 text-center">{emptyLabel}</p>

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-white/50">
            <th className="px-4 py-2 font-medium">#</th>
            <th className="px-4 py-2 font-medium">Player</th>
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-2 font-medium text-right">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isMe = profile && row.username === profile.username
            return (
              <tr
                key={row.userId ?? row.rank}
                className={`border-b border-white/5 last:border-0 ${
                  isMe ? 'bg-amber-glow/10 outline outline-1 outline-amber-glow/50 animate-pulse' : ''
                }`}
                style={isMe ? { animationDuration: '2s' } : undefined}
              >
                <td className="px-4 py-2.5 text-white/60">{row.rank}</td>
                <td className="px-4 py-2.5 font-medium text-white">{row.username ?? 'Unknown'}</td>
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-2.5 text-right tabular-nums text-white/80">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
