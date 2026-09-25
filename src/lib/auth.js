import { supabase } from './supabaseClient'

export async function signUp({ email, password, username }) {
  if (!supabase) throw new Error('Accounts are not available right now.')
  // The profiles row is created server-side by a database trigger reading
  // this metadata (see handle_new_user() in supabase/schema.sql) — a
  // client-side insert right after signUp() would fail RLS whenever email
  // confirmation is required, since there's no session yet at that point.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  })
  if (error) throw error
  return data
}

export async function signIn({ email, password }) {
  if (!supabase) throw new Error('Accounts are not available right now.')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentProfile() {
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return data
}

export async function deleteAccount() {
  if (!supabase) return
  // Cascading deletes for highscores/friendships/daily_attempts are handled
  // by ON DELETE CASCADE foreign keys in the schema (see supabase/schema.sql).
  // Actual auth.users deletion requires the service role, so this calls a
  // Postgres RPC that runs with elevated rights via SECURITY DEFINER.
  const { error } = await supabase.rpc('delete_own_account')
  if (error) throw error
}
