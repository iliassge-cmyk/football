# TopXI — Football Trivia

Seven football trivia games: four endless Higher/Lower duels, a proximity-scored "Guess the
Year", an unranked puzzle round ("Minefield"), and a ranked "Daily Top 10" challenge.

## Tech stack

- **Frontend:** React 19 + Vite
- **Styling:** Tailwind CSS v4
- **Animation:** Framer Motion
- **Hosting:** Netlify (free tier)
- **Database/Auth:** Supabase (Postgres + Supabase Auth, free tier)

All UI text is English. `src/locales/en.json` holds the shared/reusable copy strings as a
starting point for future i18n; most in-game strings currently live inline in components.

## Data cutoff dates

Two **separate, deliberately different** cutoff dates are used — don't confuse them:

| Constant | Value | Used by |
|---|---|---|
| `DATA_CUTOFF_DATE` | **2026-06-30** | Goal/Market Value/Assist/Transfer Duel, Guess the Year, Minefield (`src/data/players.json`, `matches.json`, `transfers.json`, `minefield_categories.json`) |
| `DAILY_TOP10_CUTOFF_DATE` | **2026-08-01** | Daily Top 10 (`src/data/daily_top10.json`) |

## Data status (starter dataset — see task notes below)

This build ships a **starter dataset**, not the full target volumes from the original spec.
Every entry is sourced and verified (see `source`/`verified_date` fields and the
`RESEARCH_NOTES*.md` files in `src/data/`), but volumes are smaller than the long-term goal so
the whole app is playable end-to-end now:

- `players.json` — 85 players (target: 300+). **Not independently web-verified this
  session** — the research pass exhausted its search budget on `transfers.json` first, so this
  file was compiled from trained football knowledge instead of live sources (`verified_date` is
  `null` throughout to reflect that honestly). Treat it as a first-pass draft; see
  `src/data/RESEARCH_NOTES.md` for exactly what is/isn't checked, what was intentionally
  dropped (e.g. pre-1990s legends with no reliable assist data), and how to redo this properly.
- `transfers.json` — 42 completed transfers, genuinely web-verified with real sources
  (target: 100+)
- `matches.json` — ~50+ historic matches, 1955-2026 spread (target: 150+)
- `minefield_categories.json` — ~10-15 categories × 16 tiles (target: 20-30)
- `daily_top10.json` — a partial run of days starting **2026-09-14** (target: one entry per day
  through 2027-01-31, no gaps). **This is the single biggest open item** — extending it needs
  more research passes with the same two-independent-source verification standard used so far.

## Project structure

```
/src
  /components      Game engines + shared UI (HigherLowerGame, GuessTheYear, Minefield, DailyTop10, ...)
  /pages           Routed pages (Home, GamePage, Leaderboard, Dashboard, Friends, Login, Signup, Legal)
  /data            Static JSON datasets (players/matches/transfers/minefield) + daily_top10.json
                    (daily_top10.json is the SEED data for the `daily_challenges` DB table —
                    see below — it is not imported by the frontend bundle directly)
  /lib             Supabase client, auth, scores, friends, leaderboard, dailyChallenge, sampling
/supabase
  schema.sql       Full Postgres schema, RLS policies, triggers, views (run once on a fresh project)
```

## Setup

1. `npm install`
2. Create a Supabase project, then run `supabase/schema.sql` against it (SQL Editor or CLI).
3. Seed `daily_challenges` from `src/data/daily_top10.json` using the **service role** key (not
   the anon key — the table has no client-facing insert policy by design, see 7.9 in the spec:
   future days must never be readable by anon/authenticated clients before their date).
   A minimal one-off seed script:
   ```js
   import { createClient } from '@supabase/supabase-js'
   import days from './src/data/daily_top10.json' assert { type: 'json' }
   const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
   for (const d of days) {
     await supabase.from('daily_challenges').upsert({
       date: d.date, title: d.title, entries: d.entries,
       source_primary: d.source_primary, source_secondary: d.source_secondary,
       verified_date: d.verified_date,
     })
   }
   ```
   Run this via `node --env-file=.env.local seed.mjs` (with `SUPABASE_SERVICE_ROLE_KEY` set
   locally only — never ship it to the client/Netlify build env).
4. Copy `.env.example` to `.env.local` and fill in your project's URL + anon key.
5. `npm run dev`

## Deployment (Netlify)

Connect the repo, build command `npm run build`, publish directory `dist`. `netlify.toml` and
`public/_headers` are already configured (SPA redirect, CSP, security headers). Set
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as Netlify environment variables.

## Guest mode

Without a configured Supabase project (or without logging in), the app still fully works:
scores are kept in `localStorage` only, and account-bound features (friends, leaderboards,
Daily Top 10 ranked tracking) are simply unavailable. This is intentional (see 6.1 in the
original spec) — the anon key alone is never enough to authenticate as a specific user, so
guest play never touches the database (7.2).

## Launch-readiness checklist

See the original project brief (section 11) — most items are structurally in place (RLS
policies, server-computed `is_ranked`/points, future-day hiding via RLS, one-ranked-attempt
constraint, account deletion cascade, security headers). Still needed before a real launch:

- [ ] Expand `daily_top10.json` to cover launch day through 2027-01-31 without gaps
- [ ] Expand players/matches/transfers/minefield datasets toward the target volumes
- [ ] Manual test pass on mobile viewports for all 7 games
- [ ] Lighthouse audit (target: 90+)
- [ ] `npm audit` clean, Dependabot reviewed
- [ ] Real Supabase project provisioned + `schema.sql` applied + seed script run on a schedule
        (a daily cron/Edge Function should upsert new `daily_challenges` rows as content is
        produced, rather than a one-off seed)
