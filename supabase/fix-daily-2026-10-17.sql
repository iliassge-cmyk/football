-- 2026-10-17 (Real Madrid record signings): re-checked on 2026-10-09 against the Sept 2026 list of footballtransfers.com.
-- Luka Jovic (EUR 63 m) is 10th, Figo (EUR 60 m) only 12th; Hazard / Bellingham follow that list (fees incl. add-ons). Yan Diomande is confirmed (signed 2026-08-06, fee not officially disclosed).
-- Only touches the day while it is still in the future. Safe to re-run.

update daily_challenges set
  entries = $j$[{"rank":1,"name":"Yan Diomande"},{"rank":2,"name":"Eden Hazard"},{"rank":3,"name":"Jude Bellingham"},{"rank":4,"name":"Gareth Bale"},{"rank":5,"name":"Cristiano Ronaldo"},{"rank":6,"name":"Aurélien Tchouaméni"},{"rank":7,"name":"Zinedine Zidane"},{"rank":8,"name":"James Rodríguez"},{"rank":9,"name":"Kaká"},{"rank":10,"name":"Luka Jović"}]$j$::jsonb,
  also_ran = $j$[{"rank":11,"name":"Dean Huijsen"},{"rank":12,"name":"Luís Figo"},{"rank":13,"name":"Marc Cucurella"},{"rank":14,"name":"Álvaro Carreras"},{"rank":15,"name":"Éder Militão"}]$j$::jsonb,
  sort_hint = 'Sorted by reported transfer fee incl. add-ons, highest to lowest (as of Sept 2026)',
  source_primary = 'footballtransfers.com: Real Madrid''s 25 most expensive transfers of all time (Sept 2026 version, read 2026-10-09)',
  source_secondary = 'ESPN / Press Association reports on the Yan Diomande deal (base fee about EUR 125 m, confirmed by the club on 2026-08-06, fee not officially disclosed); Bellingham, Ronaldo and Tchouameni base fees consistent with SI / Marca reports',
  verified_date = '2026-10-09'
where date = '2026-10-17' and date > (timezone('Europe/Berlin', now()))::date;

select date, jsonb_array_length(entries) as entries, jsonb_array_length(also_ran) as also_ran, verified_date from daily_challenges where date = '2026-10-17';
