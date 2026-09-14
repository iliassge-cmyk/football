export default function ComingSoonTile({ name = 'World Cup Classics' }) {
  return (
    <div className="relative flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5 opacity-60 cursor-not-allowed overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent"
        style={{ animationName: 'shimmer' }}
      />
      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
      <span className="absolute top-4 right-4 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70">
        🔒 Coming Soon
      </span>
      <div>
        <div className="text-3xl mb-3" aria-hidden="true">🌍</div>
        <h3 className="font-display text-xl font-semibold text-white/80">{name}</h3>
        <p className="mt-1 text-sm text-white/50">A new way to test your football knowledge.</p>
      </div>
    </div>
  )
}
