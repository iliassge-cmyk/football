import { useEffect, useState } from 'react'
import { X } from '@phosphor-icons/react'

// Shown once per browser session per game (sessionStorage, not localStorage —
// a new tab/session sees it again, but switching days/rounds within the same
// session doesn't re-trigger it).
function seenKey(gameKey) {
  return `topbin:seen-intro:${gameKey}`
}

export default function GameIntroModal({ gameKey, title, children }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alreadySeen = false
    try {
      alreadySeen = sessionStorage.getItem(seenKey(gameKey)) === '1'
    } catch {
      // sessionStorage unavailable (private mode, etc.) — fall through and show it
    }
    if (!alreadySeen) setOpen(true)
  }, [gameKey])

  function close() {
    setOpen(false)
    try {
      sessionStorage.setItem(seenKey(gameKey), '1')
    } catch {
      // ignore — worst case it shows again next round this session
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={close}
    >
      <div className="glass-card relative max-w-sm w-full rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={close}
          aria-label="Close"
          className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors"
        >
          <X size={20} weight="bold" />
        </button>
        <h3 className="font-display text-xl font-bold text-white mb-2 pr-6">{title}</h3>
        <div className="text-sm text-white/70 leading-relaxed space-y-2">{children}</div>
        <button
          onClick={close}
          className="mt-5 w-full rounded-xl bg-orange-glow px-4 py-2.5 text-sm font-bold text-ink-950 hover:brightness-110 transition"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
