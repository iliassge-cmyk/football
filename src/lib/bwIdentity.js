import { containsProfanity } from './profanity'

// Who you are in an online Bidding War: a random id for this device (no account needed) and a display name.
const ID_KEY = 'topbin-bw-id'
const NAME_KEY = 'topbin-bw-guest-name'

function stored(key, make) {
  try {
    let v = localStorage.getItem(key)
    if (!v) {
      v = make()
      localStorage.setItem(key, v)
    }
    return v
  } catch {
    return make()
  }
}

/** Id of this browser TAB (kept on reload): two tabs of the same browser are two different players, which also makes testing on one computer possible. */
export function tabId() {
  const make = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  try {
    let v = sessionStorage.getItem('topbin-bw-tab')
    if (!v) { v = make(); sessionStorage.setItem('topbin-bw-tab', v) }
    return v
  } catch {
    return make()
  }
}
export const deviceId = () => stored(ID_KEY, () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4))
export function guestName() {
  const make = () => `Guest ${100 + Math.floor(Math.random() * 900)}`
  try {
    let v = sessionStorage.getItem(NAME_KEY)
    if (!v) { v = make(); sessionStorage.setItem(NAME_KEY, v) }
    return v
  } catch {
    return make()
  }
}

/** A name from the network is shortened and replaced when it is not acceptable. */
export function cleanName(name, fallback = 'Guest') {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 20)
  return !n || containsProfanity(n) ? fallback : n
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function newRoomCode() {
  let c = ''
  for (let i = 0; i < 5; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return c
}
export const isRoomCode = (c) => /^[A-Z0-9]{5,12}$/.test(c ?? '')
