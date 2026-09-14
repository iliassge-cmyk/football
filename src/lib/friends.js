import { supabase } from './supabaseClient'

async function currentUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// Username-only search (7.4 — never search by email), routed through a
// SECURITY DEFINER function so it stays rate-limitable server-side.
export async function searchUsers(query) {
  if (!supabase || !query.trim()) return []
  const { data, error } = await supabase.rpc('search_profiles', { query: query.trim() })
  if (error) throw error
  const me = await currentUserId()
  return (data ?? []).filter((p) => p.id !== me)
}

export async function sendFriendRequest(addresseeId) {
  const me = await currentUserId()
  if (!me) throw new Error('Sign in to add friends.')
  const { error } = await supabase.from('friendships').insert({
    requester_id: me,
    addressee_id: addresseeId,
    status: 'pending',
  })
  if (error) throw error
}

export async function acceptFriendRequest(friendshipId) {
  const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
  if (error) throw error
}

// Also used to decline a pending request or cancel one you sent.
export async function removeFriendship(friendshipId) {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
  if (error) throw error
}

export async function listFriendState() {
  if (!supabase) return { friends: [], incoming: [], outgoing: [] }
  const me = await currentUserId()
  if (!me) return { friends: [], incoming: [], outgoing: [] }

  const { data, error } = await supabase
    .from('friendships')
    .select('id, status, requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id, username), addressee:profiles!friendships_addressee_id_fkey(id, username)')
    .or(`requester_id.eq.${me},addressee_id.eq.${me}`)
  if (error) throw error

  const friends = []
  const incoming = []
  const outgoing = []

  for (const row of data ?? []) {
    const isRequester = row.requester_id === me
    const other = isRequester ? row.addressee : row.requester
    if (row.status === 'accepted') {
      friends.push({ friendshipId: row.id, ...other })
    } else if (isRequester) {
      outgoing.push({ friendshipId: row.id, ...other })
    } else {
      incoming.push({ friendshipId: row.id, ...other })
    }
  }

  return { friends, incoming, outgoing }
}
