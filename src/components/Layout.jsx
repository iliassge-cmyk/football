import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { signOut } from '../lib/auth'
import { isBackendConfigured } from '../lib/supabaseClient'

const navLinkClass = ({ isActive }) =>
  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive ? 'text-emerald-glow bg-white/5' : 'text-white/70 hover:text-white hover:bg-white/5'
  }`

export default function Layout() {
  const { user, profile } = useAuth()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur-md">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="font-display text-2xl font-bold tracking-wide text-white">
            Top<span className="text-emerald-glow">XI</span>
          </Link>
          <div className="hidden sm:flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>Home</NavLink>
            <NavLink to="/dashboard" className={navLinkClass}>Dashboard</NavLink>
            <NavLink to="/friends" className={navLinkClass}>Friends</NavLink>
            <NavLink to="/leaderboard/daily_top10" className={navLinkClass}>Leaderboard</NavLink>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden sm:inline text-sm text-white/60">
                  {profile?.username ?? '…'}
                </span>
                <button
                  onClick={() => signOut()}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                  Log In
                </Link>
                <Link
                  to="/signup"
                  className="px-3 py-2 rounded-lg text-sm font-semibold bg-emerald-glow text-ink-950 hover:brightness-110 transition"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </nav>
        {!isBackendConfigured && (
          <div className="bg-amber-glow/15 text-amber-glow text-xs text-center py-1.5 px-4">
            Running in guest-only preview mode — connect a Supabase project (see .env.example) to enable accounts, friends and leaderboards.
          </div>
        )}
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-white/10 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-xs text-white/50 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <p className="max-w-2xl">
            All club names, logos, and trademarks are the property of their respective owners. This
            site is not affiliated with FIFA, UEFA, any national football association, or any of the
            clubs mentioned. Used for non-commercial, editorial/statistical purposes.
          </p>
          <Link to="/legal" className="shrink-0 text-white/70 hover:text-white underline underline-offset-2">
            Legal &amp; Privacy
          </Link>
        </div>
      </footer>
    </div>
  )
}
