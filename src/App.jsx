import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'

const GamePage = lazy(() => import('./pages/GamePage'))
const DailyTop10 = lazy(() => import('./components/DailyTop10'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Friends = lazy(() => import('./pages/Friends'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const Legal = lazy(() => import('./pages/Legal'))

function PageFallback() {
  return <p className="text-white/50 text-center py-12">Loading…</p>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/game/daily-top10" element={<DailyTop10 mode="today" />} />
              <Route path="/game/daily-top10/archive" element={<DailyTop10 mode="archive" />} />
              <Route path="/game/daily-top10/:date" element={<DailyTop10 mode="date" />} />
              <Route path="/game/:slug" element={<GamePage />} />
              <Route path="/leaderboard/:game" element={<Leaderboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/legal" element={<Legal />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
