import { supabase } from './supabaseClient'

export async function signUp({ email, password, username }) {
  if (!supabase) throw new Error('Accounts are not available right now.')
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error

  if (data.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, username })
    if (profileError) throw profileError
  }
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
