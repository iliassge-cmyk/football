# Daily Top 10 — Research Notes

Data cutoff for this dataset: **2026-08-01** (note: distinct from the 2026-06-30 cutoff used
elsewhere in the app). Verified 2026-09-14.

## Completed days (6 of 25 target)

| Date | Title | Source (primary) | Source (secondary) |
|---|---|---|---|
| 2026-09-14 | Premier League's all-time top 10 goalscorers | https://www.goal.com/en/news/premier-league-all-time-top-scorers-shearer-rooney-players-over-100-goals/blt7f97152540e0efce | https://www.nbcsports.com/soccer/news/premier-league-all-time-goals-leaders-scoring-records-stats-100-goals-top-50 |
| 2026-09-15 | UEFA Champions League's all-time top 10 goalscorers | https://www.uefa.com/uefachampionsleague/news/0257-0e910cf2494a-5185150de9d4-1000--champions-league-all-time-top-scorers-cristiano-ronaldo-/ | https://en.wikipedia.org/wiki/List_of_UEFA_Champions_League_top_scorers |
| 2026-09-16 | Liverpool FC's all-time top 10 goalscorers | https://www.liverpoolfc.com/info/liverpools-all-time-top-scorers | https://www.thisisanfield.com/2026/05/liverpool-top-10-all-time-goalscorers-mohamed-salah/ |
| 2026-09-17 | Ligue 1's all-time top 10 goalscorers | https://en.wikipedia.org/wiki/List_of_Ligue_1_top_scorers | https://www.goal.com/en-us/news/all-time-ligue-1-top-scorers-from-onnis-revelli/blte5c5573d5fbec3da |
| 2026-09-18 | Bundesliga's all-time top 10 goalscorers | https://www.bundesliga.com/en/faq/10-things-on-the-bundesliga/the-bundesligas-all-time-top-scorers-10552 | https://jobsinfootball.com/blog/bundesliga-top-scorers-of-all-time/ |
| 2026-09-19 | Eredivisie's all-time top 10 goalscorers | https://www.worldfootball.net/competition/co37/netherlands-eredivisie/records-all-time-goals/ | https://en.wikipedia.org/wiki/List_of_Eredivisie_top_scorers |

Notes on individual entries:
- Champions League: Mbappé and Raúl González are tied at 71 goals (list positions 5 and 6
  respectively); this tie sits mid-list, not at the rank-10 boundary, so it doesn't create
  ambiguity about who is "in the top 10."
- Bundesliga: Dieter Müller and Klaus Allofs are tied at 177 goals (list positions 9 and 10).
  Same reasoning — a genuine value tie reflected as adjacent list positions per the sourcing
  site's own ordering, not a boundary ambiguity.
- Premier League / Champions League / Ligue 1 figures reflect final 2025–26 season totals
  (those seasons concluded before the 2026-08-01 cutoff), so they should hold through the
  cutoff without off-season change.

## Categories researched but NOT included (data-quality drops)

These were investigated but dropped because the two sources either disagreed on a value,
or produced an unresolvable tie/ambiguity at the rank-10 boundary, or only partial (not full
top-10) data could be confirmed:

- **Real Madrid all-time top scorers** — sources disagreed on Ronaldo's total (450 vs 451) and
  Benzema's total (354 vs 324); could not resolve which is authoritative.
- **FC Barcelona all-time top scorers** — only Messi's total (672) was reliably confirmed;
  ranks 2–10 came back incomplete/inconsistent across sources.
- **Manchester United all-time top scorers** — Bobby Charlton's total conflicted (245 vs 249)
  and ranks 5–10 were incomplete/inconsistent.
- **Bayern Munich all-time top scorers (all competitions)** — only ranks 1–5 could be confirmed.
- **Serie A all-time top scorers** — Alessandro Del Piero and Giuseppe Signori both cited at
  188 goals for the 10th spot — an unresolvable boundary tie for "who is #10."
- **La Liga all-time top scorers** — Telmo Zarra's total conflicted between sources (251 vs 254
  goals); rest of the list was otherwise clean.
- **World Cup all-time top scorers** — six players tied at 10 goals for the 7th–10th slots
  (Rahn, Lineker, Batistuta, Cubillas, T. Müller, Lato); also very recently disrupted by the
  2026 World Cup (Mbappé's total), adding freshness risk.
- **UEFA European Championship (Euro) all-time top scorers** — only Ronaldo (1st, 14 goals) and
  Platini (2nd, 9 goals) were reliably confirmed; ranks 3–10 incomplete.
- **Copa América all-time top scorers** — multiple ties at the top (Méndez/Zizinho on 17;
  Fernández/Varela on 15; Messi/Guerrero/Vargas on 14) and incomplete data for ranks past 6th.
- **Copa Libertadores all-time top scorers** — only the record holder (Alberto Spencer, 54
  goals) was confirmed; full top 10 not retrievable.
- **Africa Cup of Nations (AFCON) all-time top scorers** — three-way tie at 11 goals for ranks
  5–7, and ranks 8–10 were not reliably confirmed.
- **Germany, Argentina, Brazil national team all-time top scorers** — only the top 2–5 spots
  were reliably confirmed in each case; Argentina and Brazil also showed conflicting *current*
  totals for still-relevant record figures (Messi 103 vs 106; general recency risk from very
  recently-active players), so these were dropped rather than guessed.

## Why only 6 of the 25 target days were completed

Two hard constraints were hit this session:
1. **WebFetch was unavailable for the entire session** — every domain tested (Wikipedia,
   Transfermarkt, worldfootball.net, UEFA.com, club sites, even generic sites like ESPN/Google)
   returned `EGRESS_BLOCKED` from the network's proxy. All research had to go through the
   WebSearch tool's synthesized snippets only, which frequently truncate long ranked tables to
   the top 3–5 entries and sometimes surface conflicting numbers from different underlying
   pages (see drop list above).
2. **The WebSearch tool's session budget (200 calls) was exhausted** mid-task, before the
   remaining ~19 categories could be researched.

Recommendation: resume this dataset in a fresh session (with a fresh WebSearch budget, and
ideally with WebFetch access restored) to research and verify the remaining ~19 days, following
the same two-independent-source, no-ties-at-the-boundary standard used above. Good candidates
worth revisiting with better tooling: club all-time top scorers for Real Madrid, Barcelona,
Bayern Munich, Manchester United, Arsenal, Chelsea, Juventus, AC Milan, Inter Milan, PSG;
national-team top scorers for Germany, Brazil, Argentina, England, France, Portugal, Spain,
Italy, Netherlands; competition top scorers for the World Cup, Euros, Copa América, Copa
Libertadores, AFCON; and club/competition all-time appearance leaders.

## Follow-up session (2026-09-14, targeting days 7–25): blocked, 0 new days added

A second session picked this up with the explicit goal of extending from 2026-09-20 onward,
prioritizing cleaner category types (appearance/caps leaders, single-tournament goalscorer
lists, all-time transfer fees, etc. — see the task brief for the full candidate list). Before
any research could happen, both available research paths were checked and found completely
unavailable, worse than the constraints hit in the first session:

1. **WebFetch: fully blocked, no exceptions found.** Tested against `en.wikipedia.org`,
   `www.premierleague.com`, and `www.transfermarkt.com` — all three returned
   `EGRESS_BLOCKED` immediately. A direct `curl` through the configured egress proxy
   (bypassing the WebFetch tool entirely, per `/root/.ccr/README.md` diagnostics) confirmed
   this is a hard proxy-level policy denial: `CONNECT tunnel failed, response 403` against
   `en.wikipedia.org`. This is an organization egress policy decision, not a flaky network —
   retrying different domains or rephrasing wouldn't help.
2. **WebSearch: budget already exhausted at session start.** The very first WebSearch call
   this session returned "this session has used its web search budget (200 of 200 WebSearch
   calls)" — i.e., 0 of 200 calls were available from the outset. (The budget appears to be
   tracked at the level of the whole Claude Code session/environment rather than per-subagent
   invocation, so calls made earlier in this same session by other work consumed it before
   this research task got a turn.)

With neither tool available, there was no way to check even one live source, let alone the two
independent, agreeing sources the data-quality bar requires. Rather than fabricate "verified"
entries from training-data memory (which is exactly the kind of unverified guess this dataset's
standard exists to prevent — see the drop list above for how often even *real* live sources
disagree on values that seem obvious), **no new days were added this session.** The dataset
remains at 6 of 25 days (2026-09-14 through 2026-09-19), unchanged from before.

**For the next attempt:** confirm before starting that (a) WebSearch has a non-zero remaining
budget for this session (raise `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` if needed, and avoid
burning calls on unrelated work earlier in the same session), and/or (b) WebFetch egress is
allowed for at least a few reference domains (Wikipedia, official league/competition sites,
Transfermarkt, worldfootball.net). If only WebSearch is available, budget it carefully per the
task brief's guidance (batch reasoning, avoid re-searching the same fact, prioritize category
types with low tie/dispute risk: national-team caps leaders, club/competition all-time
appearance leaders, single-tournament goalscorer lists, all-time transfer fees).
