// Single-owner admin gate: this project has one operator, not a team, so a
// simple allowlisted-email check (via an env var, not hardcoded) is enough -
// no separate roles/permissions table needed. Set VITE_ADMIN_EMAIL in
// .env.local / Netlify env vars to your own account's email.
export function isAdmin(user) {
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  return Boolean(adminEmail && user?.email && user.email.toLowerCase() === adminEmail.toLowerCase())
}
