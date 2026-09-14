// Deliberately small, conservative blocklist for usernames (7.5). This is a
// first line of defense only — it catches the obvious cases without trying
// to be an exhaustive moderation system.
const BLOCKED_SUBSTRINGS = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'cunt',
  'nigger',
  'nigga',
  'faggot',
  'rape',
  'hitler',
  'nazi',
]

export function containsProfanity(username) {
  const lower = username.toLowerCase()
  return BLOCKED_SUBSTRINGS.some((word) => lower.includes(word))
}
