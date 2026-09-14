# Research notes — TopXI starter datasets

## IMPORTANT: tool constraints hit during this session

This session's research ran into two hard blockers partway through:

1. **WebSearch quota exhausted.** The session's WebSearch budget (200 calls) was
   fully consumed while researching `transfers.json` (fees, dates, clubs for ~42
   transfers, spanning 1996–2026). By the time work moved on to `players.json`,
   zero WebSearch calls remained (confirmed by repeated "used its web search
   budget (200 of 200)" tool errors).
2. **WebFetch is network-blocked for essentially all football/sports sources
   in this sandbox.** Every fetch attempt returned `EGRESS_BLOCKED` or an
   equivalent failure for: en.wikipedia.org, simple.wikipedia.org,
   www.espn.com, www.skysports.com, www.bbc.com, www.cbssports.com,
   www.footballtransfers.com, and www.transfermarkt.com. No alternative
   football-statistics domain was reachable. (The outbound proxy's own status
   endpoint was also not queryable via Bash due to a separate permission
   classifier block.)

### What this means for each file

- **`transfers.json` (42 entries): genuinely researched.** Every fee, year,
  and club pairing was pulled from live WebSearch results during this session,
  each with a real source URL returned by the search tool and inspected before
  being written down. Where a fee was reported in GBP/USD only, it was
  converted to EUR using a period-appropriate approximate exchange rate (noted
  below) rather than treated as an EUR-native figure — this is the one place
  where a number in that file is a computed estimate rather than a directly
  quoted figure.
- **`players.json` (85 entries): NOT independently web-verified this session.**
  Once the WebSearch budget ran out and WebFetch proved unusable, there was no
  remaining way to check any player's career goals/assists/market value
  against a live source. Rather than inventing numbers or falsely labeling
  them as freshly checked, this file was compiled from the assistant's trained
  knowledge (general knowledge cutoff ~January 2026), which for most
  long-tenured and retired players is very stable, well-corroborated public
  information, but which:
  - may be **stale for the 2025–26 season's in-progress totals** (the task's
    2026-06-30 cutoff could not be confirmed for any actively-playing player),
  - may be **wrong for recent transfers/club moves** beyond what was
    incidentally confirmed via the transfers.json research (see "Incidentally
    confirmed via transfer research" below),
  - includes **estimated market values** for active players (mid/late-2026
    valuations were not checkable at all) — treat these as rough, plausible
    figures only, not quotes from Transfermarkt or any other valuation source,
  - required **dropping several historically iconic players entirely**
    (Pelé, Maradona, Cruyff, Beckenbauer, Di Stéfano, Puskás, Eusébio, Best)
    because their career assist totals are not reliably documented (pre-1990s
    football did not track assists consistently), and stating a number for
    them would have been a guess, which the task explicitly said to avoid.
    Their goal tallies also vary meaningfully by source (e.g. Pelé's total is
    cited anywhere from ~650 to 1281 depending on which matches are counted),
    reinforcing the decision to leave them out rather than pick one figure.

**Recommendation:** treat `players.json` as a first-pass draft. Before shipping
it, spot-check figures against Transfermarkt/Wikipedia directly (this
environment could not reach either), or re-run this research with a raised
`CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` so every player entry gets the same
live-search treatment the transfers got.

---

## Transfers — GBP/USD → EUR conversion methodology

Where only a GBP fee was reported and no EUR figure was directly quoted by a
source, an approximate period exchange rate was applied (GBP/EUR ≈ 1.13–1.17
across 2009–2026, with earlier-2000s / 1990s transfers using a looser
retrospective ~1.4 estimate since the euro did not exist as a circulating
currency before 1999). Affected entries: `vandijk-southampton-liverpool-2018`,
`maguire-leicester-manutd-2019`, `torres-liverpool-chelsea-2011`,
`wirtz-leverkusen-liverpool-2025`, `rogers-astonvilla-chelsea-2026`,
`anderson-forest-mancity-2026`, `shearer-blackburn-newcastle-1996`. All other
`transfers.json` entries use an EUR figure that was directly stated by a
source during the session's WebSearch results.

## Transfers with notable source disagreement

- **Christian Vieri (Lazio→Inter, 1999):** sources cited figures ranging from
  ~€43m to ~€49m for the same transfer (currency conversion noise from the
  original lira fee). Used €46.5m as a midpoint; flagged here rather than
  presented as a single unambiguous figure.
- **Philippe Coutinho (Liverpool→Barcelona, 2018):** reported as €120m
  up-front rising to €160m with add-ons; this file uses the €120m
  guaranteed/initial figure for consistency with how the rest of the dataset
  handles add-on-heavy deals (initial/guaranteed fee, not the maximum
  potential total). Same convention applied to Dembélé (€105m of a possible
  €148m), Hazard (€100m of a possible €146m), and Osimhen (€75m net, no
  material add-on ambiguity reported).

## Players.json — entries omitted for lack of verifiable assist data

Pelé, Diego Maradona, Johan Cruyff, Franz Beckenbauer, Alfredo Di Stéfano,
Ferenc Puskás, Eusébio, George Best — all excluded. Their goal tallies are
widely known but contested across sources, and reliable career assist figures
effectively don't exist for most of their careers (assists were not
consistently recorded in the leagues/eras they played in). Including them
with an invented assist number would have violated the "don't guess" rule.

## Players.json — market values

All `market_value_eur` figures for active players are the assistant's rough,
plausible estimates only (not sourced from Transfermarkt or any live
valuation), since no valuation site was reachable this session. Retired
players are set to `0` per the task's own convention for retired legends.

## Cross-check disclosure

The task asked for a genuine two-source cross-check on at least 10 player
entries, logged here. **This could not be done as specified** — with
WebSearch exhausted and WebFetch blocked, no second live source could be
consulted for any player entry this session. The 42 transfers, by contrast,
were each checked against multiple independent search results (Sky Sports,
ESPN, CBS Sports, Goal.com, CNN, Bleacher Report, club-official sites, etc.)
as part of the normal WebSearch process before being recorded — that
diligence is reflected in the `source` URLs in `transfers.json`, which are
genuine, inspected sources rather than placeholders.
