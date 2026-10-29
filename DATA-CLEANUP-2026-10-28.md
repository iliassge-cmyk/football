# Data clean-up 2026-10-28 (Transfermarkt / tmapi spelling is the reference)

Backup of everything that was changed: `C:\Users\Iman\.claude\Neuer Ordner\data-backup-2026-10-28\` (data files, the removed logo duplicates, the removed data copies).

| # | What | Where |
|---|---|---|
| 1 | One club master table: canonical name, aliases, logo, coordinates. Players, transfers and matches carry club ids (`club_id`, `from_club_id`, `to_club_id`, `home_id`, `away_id`) and the canonical club name | `src/data/clubs.json`, built by `scripts/clean-data.mjs`, `scripts/merge-clubs.mjs`, `scripts/fix-aliases.mjs` |
| 2 | Status out of the club name: `status: "retired" / "free_agent"` instead of "(retired)" / "Free agent (formerly X)" | `src/data/players.json`; readers updated (site: `blindRanking.js`, `GamePage.jsx`, `BlindParts.jsx`; scripts; `marketing/sync-from-tm.mjs` writes the new format and keeps `clubs.json` up to date) |
| 3 | 22 identical logo files removed (references re-pointed), missing logos looked up (352 of 359 clubs have a logo) | `marketing/clublogos2/`, `scripts/dedupe-logos.mjs`, `marketing/find-club-logos.mjs` |
| 4 | Quiz names: short forms -> full player names (332 tile names, 85 different) | `src/data/minefield_categories.json`, `minefield_daily.json`, `scripts/normalize-quiz-names.mjs` |
| 5 | Transfer fee: Transfermarkt where it knows the same transfer (previous value kept in `fee_eur_previous`, `fee_source: "transfermarkt"`) | `src/data/transfers.json` |
| 6 | One copy of the data: `topbin-content/data/players.json` and `transfers.json` removed; the reels read the site file. The three club files of the reels are generated from `clubs.json` | `node scripts/build-club-files.mjs` |

After a change of `src/data/clubs.json` (new club, new logo file) run `node scripts/build-club-files.mjs`.
