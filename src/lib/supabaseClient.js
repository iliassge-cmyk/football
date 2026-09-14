import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// If env vars are missing (e.g. local dev without a Supabase project yet),
// the app still runs in guest-only mode: every accountbound feature
// (auth, ranked scores, friends, leaderboards) simply stays disabled
// instead of crashing.
export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

export const isBackendConfigured = Boolean(supabase)
