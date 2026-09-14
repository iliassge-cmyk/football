# TopXI — Football Trivia

Seven football trivia games: four endless Higher/Lower duels, a proximity-scored "Guess the
Year", and two **ranked, dated daily challenges** — "Daily Top 10" and "Minefield" — each with a
16-day day-picker (today counts for the leaderboard; past days are unranked practice).

## Tech stack

- **Frontend:** React 19 + Vite
- **Styling:** Tailwind CSS v4 — orange/black theme
- **Animation:** Framer Motion
- **Hosting:** Netlify (free tier)
- **Database/Auth:** Supabase (Postgres + Supabase Auth, free tier)

All UI text is English. `src/locales/en.json` holds the shared/reusable copy strings as a
starting point for future i18n; most in-game strings currently live inline in components.

## Minefield is now a ranked, dated mode (changed from the original spec)

Minefield originally shipped as a stateless, unranked, DB-free "just for fun" game (a random
category from a static pool each round). A later request asked for it to work like Daily Top 10
instead: one category a day, a day-picker for the last 16 days, and only the *first* play of
*today's* category counting for the leaderboard — replays of past days are unranked practice,
same as Daily Top 10's archive.

That's now the only Minefield mode. It's built on `minefield_challenges`/`minefield_attempts`
tables that mirror `daily_challenges`/`daily_attempts` exactly (same future-day RLS hiding, same
server-computed `is_ranked`, same one-ranked-attempt-per-day constraint — see `supabase/schema.sql`).

**One thing to flag:** the *points-per-clear* formula for ranked Minefield isn't specified
anywhere in the original brief the way Daily Top 10's lives→points table is. We picked a
reasonable default (fewer bombs hit while still clearing all 10 safe tiles scores higher — see
`pointsForBombs()` in `src/lib/minefieldChallenge.js` and the trigger in `schema.sql`); it's an
easy constant to tune later if the actual owner wants different numbers.

The two dated modes share a `DayPicker` component (`src/components/DayPicker.jsx`) and a small
factory (`src/lib/challengeApi.js`) that generates the read/write API both use, since the
underlying pattern is identical for both.

## Data cutoff dates

Two **separate, deliberately different** cutoff dates are used — don't confuse them:

| Constant | Value | Used by |
|---|---|---|
| `DATA_CUTOFF_DATE` | **2026-06-30** | Goal/Market Value/Assist/Transfer Duel, Guess the Year (`players.json`, `matches.json`, `transfers.json`) |
| `DAILY_TOP10_CUTOFF_DATE` | **2026-08-01** | Daily Top 10 and Minefield's dated categories (`daily_top10.json`, `minefield_categories.json` / `minefield_daily.json`) |

## Data status (still a starter dataset — the single biggest open item)

Every entry is sourced and verified (see `source`/`verified_date` fields and the
`RESEARCH_NOTES*.md` files in `src/data/`), and volumes have grown across a few research passes,
but they're still short of the long-term targets from the original brief:

- `players.json` — **124 players** (target: 300+), genuinely web-verified this round (real
  sources, `verified_date` set). An earlier pass had compiled 85 of these from trained knowledge
  without live verification when its search budget ran out first — that gap has since been closed.
- `transfers.json` — **42 transfers** (target: 100+), web-verified
- `matches.json` — **100 matches**, 1955–2026 spread (target: 150+), web-verified
- `minefield_categories.json` — **9 categories** × 16 tiles (target: 20-30). Each of these 9 is
  individually web-verified (all 16 tiles per category, not just a sample).
- `minefield_daily.json` — **9 dated days** (2026-09-14 → 2026-09-22), one per category above.
  Regenerate from `minefield_categories.json` with `npm run db:generate-minefield-daily` whenever
  that file grows — it deliberately does **not** repeat categories to fill all 16 day-picker
  slots, so days past the available count stay greyed out in the UI rather than showing a
  duplicate.
- `daily_top10.json` — **10 days** (2026-09-14 → 2026-09-23), dual-sourced (target: one entry per
  day through 2027-01-31, no gaps). Still the largest gap — every research pass so far has hit the
  same wall (WebSearch budget exhausted, WebFetch blocked) partway through; see
  `RESEARCH_NOTES_DAILY.md` for exactly which categories are queued up for the next attempt.

Every research pass has been honest about running out of tool budget rather than padding with
guessed data — dropped/uncertain entries are logged in each `RESEARCH_NOTES*.md` with why.

## Project structure

```
/src
  /components      Game engines + shared UI:
                      HigherLowerGame, GuessTheYear    - the 4 duels + proximity game
                      DailyTop10, Minefield, DayPicker  - the 2 ranked dated modes + shared picker
                      GameCard, ComingSoonTile, ShareResult, LeaderboardTable, ...
  /pages           Routed pages (Home, GamePage, Leaderboard, Dashboard, Friends, Login, Signup, Legal)
  /data            Static JSON datasets (players/matches/transfers) bundled into the frontend,
                    PLUS the seed sources for the two dated-mode DB tables — daily_top10.json and
                    minefield_categories.json/minefield_daily.json are NOT imported by the
                    frontend bundle; they're only ever written into the database (see below),
                    since future days must stay invisible client-side (7.9)
  /lib             Supabase client, auth, scores, friends, leaderboard, challengeApi (shared
                    factory for dailyChallenge.js + minefieldChallenge.js), sampling
/supabase
  schema.sql                       Full Postgres schema, RLS policies, triggers, views
  seed-daily-challenges.sql        Generated — paste into SQL Editor to seed Daily Top 10
  seed-minefield-challenges.sql    Generated — paste into SQL Editor to seed Minefield
/scripts           Provisioning scripts — see Setup below
```

## Setup

1. `npm install`
2. Create a Supabase project (dashboard: [supabase.com](https://supabase.com)).
3. Apply the schema — run `supabase/schema.sql` via the SQL Editor, **or** non-interactively:
   ```
   DATABASE_URL="postgres://postgres:[password]@db.[ref].supabase.co:5432/postgres" \
     npm run db:apply-schema
   ```
   (Project Settings → Database → Connection string → URI. Safe to re-run — the schema uses
   `CREATE ... IF NOT EXISTS` / `CREATE OR REPLACE` throughout.)
4. Seed the two dated challenge tables. Neither has a client-facing insert policy by design (7.9:
   future days must never be readable before their date), so this needs elevated access — two
   options for each:
   - **No terminal needed:** paste `supabase/seed-daily-challenges.sql` and
     `supabase/seed-minefield-challenges.sql` into the SQL Editor (same place as step 3) and run
     them. Both are pre-generated and safe to re-run (upsert by `date`). Regenerate after editing
     the source JSON with `npm run db:generate-seed-sql` / `npm run db:generate-minefield-seed-sql`
     (and, for Minefield, `npm run db:generate-minefield-daily` first if `minefield_categories.json`
     changed).
   - **Or via the service role key**, non-interactively:
     ```
     SUPABASE_URL="https://[ref].supabase.co" \
     SUPABASE_SERVICE_ROLE_KEY="..." \
       npm run db:seed-daily
       npm run db:seed-minefield
     ```
     Never put the service role key in `.env`/Netlify env — it's for one-off local/CI seeding only.

   Either way, this should eventually run on a schedule (daily cron/Edge Function) as new days
   are researched, not as a one-off.
5. Copy `.env.example` to `.env.local` and fill in your project's URL + anon key.
6. `npm run dev`

## Deployment (Netlify)

Connect the repo, build command `npm run build`, publish directory `dist`. `netlify.toml` and
`public/_headers` are already configured (SPA redirect, CSP, security headers). Set
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as Netlify environment variables.

## Guest mode

Without a configured Supabase project (or without logging in), the app still fully works:
scores are kept in `localStorage` only, and account-bound features (friends, leaderboards,
ranked tracking for both dated modes) are simply unavailable. This is intentional (see 6.1 in the
original spec) — the anon key alone is never enough to authenticate as a specific user, so
guest play never touches the database (7.2).

## Launch-readiness checklist

See the original project brief (section 11) — most items are structurally in place (RLS
policies, server-computed `is_ranked`/points for both dated modes, future-day hiding via RLS,
one-ranked-attempt constraint, account deletion cascade, security headers). Still needed before a
real launch:

- [ ] Expand `daily_top10.json` to cover launch day through 2027-01-31 without gaps (the biggest
        remaining gap — see Data status above)
- [ ] Expand `minefield_categories.json` well past 9 so Minefield's day-picker isn't mostly
        greyed out, then regenerate `minefield_daily.json`
- [ ] Expand players/matches/transfers datasets further toward the target volumes
- [ ] Confirm (or adjust) the Minefield ranked-points formula — it's our default, not a spec'd number
- [ ] Manual test pass on mobile viewports for all 7 games
- [ ] Lighthouse audit (target: 90+)
- [ ] `npm audit` clean, Dependabot reviewed
- [ ] Real Supabase project provisioned + `schema.sql` applied + both seed scripts run on a
        schedule (a daily cron/Edge Function should upsert new challenge rows for both modes as
        content is produced, rather than a one-off seed)
