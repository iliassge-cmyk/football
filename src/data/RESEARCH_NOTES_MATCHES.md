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
