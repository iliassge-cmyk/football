# Research notes — matches.json

Methodology: every match was researched via web search, which in this environment returns
a synthesized answer drawing on multiple independent outlets per query (typically a mix of
UEFA.com, ESPN, Wikipedia, official club sites, and wire-service coverage reproduced by
outlets such as AP/Reuters via CNN, Al Jazeera, CBS Sports, Fox Sports, Gulf News, etc.).
Direct `WebFetch` to en.wikipedia.org, espn.com, uefa.com, skysports.com, premierleague.com
and cbssports.com was blocked by this session's network egress policy (`EGRESS_BLOCKED`),
so explicit second-source verification below was done by issuing a second, differently
worded search query and comparing the independent outlets it surfaced against the first
query's results, rather than by fetching a single page twice. `source` URLs in matches.json
point to the canonical Wikipedia article for each match/event even though it could not be
fetched directly, since its content was corroborated by the search results.

Any match/goal detail I could not corroborate with reasonable confidence was either omitted
(the `minute` field is dropped, per the schema note, rather than guessed) or the whole match
was left out of the dataset. No fixture in the file is invented.

## Matches cross-checked against a second independent source (10+)

1. **1968 European Cup final (Man Utd 4-1 Benfica)** — checked against ESPN/SI.com summary
   and a second query pulling Fandom/Irish Times/UEFA.com coverage. All scorers and minutes
   (Charlton 53', Graça 79', Best 92', Kidd 94', Charlton 99') agreed across sources.

2. **1960 European Cup final (Real Madrid 7-3 Eintracht Frankfurt)** — cross-checked via
   Statsbomb historical analysis, Scottish FA (Hampden Park) retrospective, and UEFA.com.
   Full scoreline, Di Stéfano/Puskás hat-trick+four split, and Kress's 18th-minute opener
   agreed everywhere. Individual minute-by-minute detail for all 10 goals was **not**
   consistently available across sources (one source describes Puskás's four goals as
   coming "between the 45th and 71st minute" without a clean per-goal breakdown), so
   individual minutes for Di Stéfano's and Puskás's goals were left out rather than guessed.

3. **1994 UEFA Champions League final (AC Milan 4-0 Barcelona)** — cross-checked Goal.com,
   AC Milan's official site, and a targeted follow-up search. Minor discrepancy found:
   Desailly's goal is given as "58th minute" by most outlets, but one summary calculated
   "55th minute" (eight minutes after Savićević's 47th-minute goal). Went with 58', the
   figure repeated by the larger number of independent outlets (incl. AC Milan's own site).

4. **2005 UEFA Champions League final ("Miracle of Istanbul", AC Milan 3-3 Liverpool)** —
   cross-checked LFChistory.net, ESPN, and Opta Analyst (theanalyst.com) retrospectives.
   All agree on Maldini 1', Crespo 39' & 44', Gerrard 54', Šmicer 56', Alonso 60' (rebound
   after his penalty was saved), and the 3-2 penalty shoot-out win for Liverpool.

5. **2017 Champions League Round of 16, 2nd leg ("La Remontada", Barcelona 6-1 PSG)** —
   cross-checked Wikipedia's dedicated match article, ESPN, WhoScored and UEFA.com. Minor
   discrepancy: Neymar's second goal and Sergi Roberto's winner are given as 90+1' / 90+5'
   by some outlets and as flat "91'" / "95'" by others; both describe the same passage of
   stoppage-time play, so I used the flat added-time figures (91', 95') for consistency with
   the rest of the dataset. All 7 goals and scorers otherwise agreed.

6. **1997 Champions League final (Borussia Dortmund 3-1 Juventus)** — cross-checked
   90min.com, Bundesliga.com and Grokipedia summaries against the initial search. Riedle's
   two goals (29', 34'), Del Piero's goal (65'), and Ricken's famous 16-seconds-after-coming-on
   goal (71') were consistent across all sources.

7. **Euro 1996 final (Germany 2-1 Czech Republic, golden goal)** — cross-checked UEFA.com's
   "Classics" retrospective against Gulf News/Malay Mail wire coverage. Berger's 59th-minute
   penalty, Bierhoff's 73rd-minute equalizer, and his 95th-minute golden goal winner were
   consistent everywhere.

8. **2012 Champions League final (Chelsea 1-1 Bayern Munich, pens)** — cross-checked CNN
   and Simple Wikipedia against the initial UEFA.com/CBS-style search. Müller 83', Drogba
   88', and the 4-3 penalty shoot-out result (with Drogba scoring the winning kick) agreed;
   full penalty-taker order was also corroborated by Chelsea FC's own site.

9. **Manchester City 3-2 QPR (13 May 2012, Premier League title decider)** — cross-checked
   Opta Analyst's "About That Game" retrospective against Al Jazeera and ESPN match
   reports. Full scoring sequence (Zabaleta 39', Cissé 48', Mackie 66', Dzeko 90+2',
   Agüero 90+4') agreed across sources; Agüero's goal is universally described as arriving
   with "93:20" on the game clock, which is the minute value used in the dataset.

10. **2022 Champions League final (Real Madrid 1-0 Liverpool)** — cross-checked The National
    and UEFA.com's own match report against Bleacher Report/CBS Sports coverage. Vinícius
    Júnior's 59th-minute winner (Valverde assist) was consistent everywhere.

11. **2000 Champions League final (Real Madrid 3-0 Valencia)** — initial search only
    confirmed the scorers (Morientes, McManaman, Raúl) without minutes; a follow-up query
    against UEFA.com's official 1999/2000 report confirmed 39', 67', 75'.

12. **1979 European Cup final (Nottingham Forest 1-0 Malmö)** — venue was not returned by
    the first search (only "Trevor Francis scored the only goal"); a follow-up query
    confirmed the Olympiastadion, Munich, and an attendance of 68,500.

## Notable exclusions / matches left out for lack of solid verification

- **Individual per-goal minutes for the 1989 European Cup final (AC Milan 4-0 Steaua
  București)** — every source agrees Gullit and Van Basten scored two goals each, but no
  source returned a reliable minute-by-minute breakdown, so minutes were omitted for all
  four goals rather than guessed.
- **1966 European Cup final (Real Madrid 2-1 Partizan Belgrade)** and several other 1960s
  finals were considered but dropped in favour of more globally iconic matches to keep the
  dataset focused on games with strong, consistent sourcing.
- A number of famous non-final matches (e.g. specific Bundesliga or Serie A title-decider
  fixtures, El Salvador–style "goal of the century" club friendlies) were considered but
  excluded because I could not find a source giving a fully confident final score AND
  scorer list AND venue within the time available; per the brief, they were dropped rather
  than included with guessed details.
- The Leicester City 2015–16 Premier League title win was considered but excluded because
  it is a season-long achievement rather than a single iconic match with a clean scoreline.

---

## Session 2 (2026-09-14): grew matches.json from 53 to 100 entries

Added 47 new matches via live WebSearch (this session's WebSearch budget was shared with
earlier work in the same session on `transfers.json`/`players.json`; it ran out entirely
partway through the *next* task — growing `minefield_categories.json` — see
`RESEARCH_NOTES.md` for that). Every one of the 47 new matches below was checked against at
least one live WebSearch query returning independent outlets (Wikipedia, UEFA.com, ESPN,
club sites, Sky Sports, etc.); several were cross-checked with a second, differently-worded
query when a detail (scorer minutes, exact aggregate context) was ambiguous on the first
pass. WebFetch to en.wikipedia.org/espn.com/etc. was confirmed blocked again this session
(`EGRESS_BLOCKED`), so all verification was via WebSearch's synthesized multi-source answers,
consistent with Session 1's methodology.

New matches added, by type:
- **UEFA Cup Winners' Cup finals (7):** 1963 Tottenham 5-1 Atlético Madrid, 1970 Man City 2-1
  Górnik Zabrze, 1989 Barcelona 2-0 Sampdoria, 1991 Man Utd 2-1 Barcelona, 1994 Arsenal 1-0
  Parma, 1997 Barcelona 1-0 PSG, and their venues/scorers each confirmed via search.
- **UEFA Cup / Europa League finals (8):** 1984 Tottenham (agg 2-2, pens), 1998 Inter 3-0
  Lazio, 1999 Parma 3-0 Marseille, 2001 Liverpool 5-4 Alavés (golden goal), 2016 Sevilla 3-1
  Liverpool, 2019 Chelsea 4-1 Arsenal, 2022 Frankfurt 1-1 Rangers (pens), 2023 Sevilla 1-1
  Roma (pens), 2025 Tottenham 1-0 Man Utd.
- **European Cup / Champions League finals not previously in the file (9):** 1961 Benfica 3-2
  Barcelona, 1962 Benfica 5-3 Real Madrid (Puskás hat-trick on the losing side), 1965 Inter
  1-0 Benfica, 1966 Real Madrid 2-1 Partizan, 1967 Celtic 2-1 Inter (Lisbon Lions), 1972 Ajax
  2-0 Inter, 1973 Ajax 1-0 Juventus, 1976 Bayern 1-0 Saint-Étienne, 1980 Nottingham Forest
  1-0 Hamburg, 1981 Liverpool 1-0 Real Madrid, 1988 PSV 0-0 Benfica (pens), 1991 Red Star 0-0
  Marseille (pens), 1993 Marseille 1-0 AC Milan.
- **Notable non-final Champions League matches (7):** Deportivo 4-0 Milan (2004 QF2, one of
  the great comebacks), PSG 4-0 Barcelona (2017 R16 1st leg, the "Remontada" setup — the
  reverse fixture was already in the file), Barcelona 3-0 Bayern (2015 SF1), Bayern 8-2
  Barcelona (2020 QF), Real Madrid 4-2 Bayern AET (2017 QF2, Ronaldo hat-trick), Man City 4-3
  Real Madrid and Real Madrid 3-1 Man City AET (2022 SF, both legs), Ajax 4-1 Real Madrid
  (2019 R16 2nd leg).
- **UEFA European Championship (5):** 1968 final replay, 1972 final, 1980 final, and two
  Euro 2016 knockout upsets (Iceland 2-1 England, Wales 3-1 Belgium).
- **Domestic league matches (7):** Newcastle 5-0 Man Utd (1996), Liverpool 4-3 Newcastle
  (1996, the "best Premier League game ever"), Man Utd 8-2 Arsenal (2011), Man Utd 1-6 Man
  City (2011), Barcelona 5-0 Real Madrid (2010 Clásico), Chelsea 2-2 Tottenham (2016,
  confirmed Leicester's title).

### Corrections caught mid-research (own-goal / scoreline confusion)
- An early search claimed a "Carl Jenkinson own goal" in the 2011 Man Utd 8-2 Arsenal game;
  a follow-up query explicitly confirmed Arsenal had only two scorers (Walcott, Van Persie),
  so the Jenkinson detail was dropped as unreliable rather than included.
- An early search for the 2017 Real Madrid–Bayern Munich Champions League QF said "3-0";
  the actual second leg (after extra time) was 4-2 to Real Madrid (6-3 on aggregate). A
  follow-up query for the precise goal timeline resolved this and also dropped an incorrect
  "Vidal 84'" goal claim that didn't reconcile with the final scoreline.
- Own-goal `team` field follows the same convention already used in the pre-existing
  `barcelona-psg-remontada-2017` entry (Kurzawa (o.g.)): `team` records the scoring player's
  own team, not the team that benefits from the goal.

### Matches considered but dropped this session
- A number of additional Sevilla Europa League finals (2014, 2015, 2020) and further Ajax/
  Bayern 1970s European Cup matches were considered but not pursued once 100 total entries
  was reached and the WebSearch budget grew scarce; none were included with guessed details.
