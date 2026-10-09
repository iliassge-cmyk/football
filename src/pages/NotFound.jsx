import { Link } from 'react-router-dom'
import { useNoIndex } from '../lib/useNoIndex'

/** Shown for every address the app does not know (instead of a blank page). */
export default function NotFound() {
  useNoIndex()
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-display text-7xl font-extrabold text-orange-glow">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-white">That page isn’t on the pitch</h1>
      <p className="mt-3 text-white/60">The link may be old or mistyped. Pick up where the game is:</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/" className="rounded-xl bg-orange-glow px-5 py-2.5 font-semibold text-ink-950 hover:brightness-110">
          Home
        </Link>
        <Link to="/game/daily-top10" className="rounded-xl border border-white/15 px-5 py-2.5 font-semibold text-white hover:bg-white/5">
          Daily Top 10
        </Link>
        <Link to="/game/minefield" className="rounded-xl border border-white/15 px-5 py-2.5 font-semibold text-white hover:bg-white/5">
          Minefield
        </Link>
      </div>
    </div>
  )
}
