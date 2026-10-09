-- Corrections after a second-source check (2026-10-08) of the next curated Daily Top 10 days.
-- 2026-10-09 and 2026-10-18: lineups confirmed, second source added.
-- 2026-10-14 (Manchester United record sales): ranks 5-10 were wrong (Hojlund, Mkhitaryan, wrong order) - replaced by the Wikipedia table.
-- 2026-10-11 (Champions League appearances): Giggs was 13th, not 9th (UEFA ranking, Sept 2026); 10th place is a three-way tie (Raul, Modric, Ramos, 142 each) - Raul is listed.
-- Only touches days that are still in the future. Safe to re-run.

update daily_challenges set source_secondary = 'Wikipedia: 2010 FIFA World Cup final (starting lineups) - checked 2026-10-08', verified_date = '2026-10-08'
where date = '2026-10-09' and date > (timezone('Europe/Berlin', now()))::date;

update daily_challenges set source_secondary = 'Wikipedia: 2018 UEFA Champions League final (starting lineups) - checked 2026-10-08', verified_date = '2026-10-08'
where date = '2026-10-18' and date > (timezone('Europe/Berlin', now()))::date;

update daily_challenges set entries = $j$[{"rank":1,"name":"Cristiano Ronaldo"},{"rank":2,"name":"Romelu Lukaku"},{"rank":3,"name":"Ángel Di María"},{"rank":4,"name":"Alejandro Garnacho"},{"rank":5,"name":"Mason Greenwood"},{"rank":6,"name":"Scott McTominay"},{"rank":7,"name":"Daniel James"},{"rank":8,"name":"David Beckham"},{"rank":9,"name":"Morgan Schneiderlin"},{"rank":10,"name":"Memphis Depay"}]$j$::jsonb, sort_hint = 'Sorted by transfer fee received, highest to lowest (permanent sales)', source_primary = 'Wikipedia: List of Manchester United F.C. records and statistics - Highest transfer fees received (read 2026-10-08)', source_secondary = 'Goal.com and Sportskeeda articles on United''s biggest sales confirm ranks 1-4 and Daniel James (ranks 5-10 only from the primary source)', verified_date = '2026-10-08'
where date = '2026-10-14' and date > (timezone('Europe/Berlin', now()))::date;

update daily_challenges set entries = $j$[{"rank":1,"name":"Cristiano Ronaldo"},{"rank":2,"name":"Iker Casillas"},{"rank":3,"name":"Lionel Messi"},{"rank":4,"name":"Thomas Müller"},{"rank":5,"name":"Manuel Neuer"},{"rank":6,"name":"Karim Benzema"},{"rank":7,"name":"Toni Kroos"},{"rank":8,"name":"Xavi Hernández"},{"rank":9,"name":"Robert Lewandowski"},{"rank":10,"name":"Raúl González"}]$j$::jsonb, sort_hint = 'Sorted by appearances, highest to lowest (UEFA, Sept 2026; 10th place is shared)', source_primary = 'UEFA.com: Champions League all-time appearances (updated 2026-09-10)', source_secondary = null, verified_date = '2026-10-08'
where date = '2026-10-11' and date > (timezone('Europe/Berlin', now()))::date;

select date, jsonb_array_length(entries) as entries, source_secondary is not null as has_second_source, verified_date from daily_challenges where date in ('2026-10-09','2026-10-11','2026-10-14','2026-10-18') order by date;
