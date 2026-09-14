import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'

const GamePage = lazy(() => import('./pages/GamePage'))
const DailyTop10 = lazy(() => import('./components/DailyTop10'))
const Minefield = lazy(() => import('./components/Minefield'))
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
              <Route path="/game/daily-top10/archive" element={<Navigate to="/game/daily-top10" replace />} />
              <Route path="/game/daily-top10/:date" element={<DailyTop10 mode="date" />} />
              <Route path="/game/minefield" element={<Minefield mode="today" />} />
              <Route path="/game/minefield/:date" element={<Minefield mode="date" />} />
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
