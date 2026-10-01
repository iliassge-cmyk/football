-- =============================================================================
-- TopBin - Supabase schema, RLS policies, triggers
-- Run against a fresh Supabase project (SQL Editor, or `supabase db push`).
--
-- Genuinely safe to paste and re-run in full any time this file changes
-- (e.g. after a feature adds new tables): every statement is idempotent -
-- tables/indexes/views/functions use IF NOT EXISTS / OR REPLACE, and every
-- policy is preceded by a matching `drop policy if exists` since Postgres
-- has no `CREATE POLICY IF NOT EXISTS`. (An earlier version of this file
-- was NOT actually idempotent for policies/triggers - re-pasting it after
-- the first run would fail on the very first policy statement, before ever
-- reaching new tables added later in the file. Fixed.)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  username_changed_at timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  constraint username_length check (char_length(username) between 3 and 20),
  constraint username_charset check (username ~ '^[a-zA-Z0-9_]+$')
);

alter table profiles enable row level security;

drop policy if exists "profiles_select_public" on profiles;
create policy "profiles_select_public" on profiles
  for select using (true);

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-creates the profiles row when a new auth.users row appears, via
-- security definer (bypasses RLS). This runs at signUp() time regardless of
-- whether "Confirm email" is enabled - a client-side insert right after
-- signUp() would otherwise fail RLS whenever there's no session yet (i.e.
-- email confirmation required), since auth.uid() is null until confirmed.
-- The username is passed through signUp()'s options.data (see src/lib/auth.js).
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Enforce "username change once per 30 days" server-side (6.6).
create or replace function enforce_username_cooldown()
returns trigger as $$
begin
  if new.username <> old.username then
    if old.username_changed_at > now() - interval '30 days' then
      raise exception 'Username can only be changed once every 30 days.';
    end if;
    new.username_changed_at := now();
  end if;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger trg_username_cooldown
  before update on profiles
  for each row execute function enforce_username_cooldown();

-- ---------------------------------------------------------------------------
-- friendships
-- ---------------------------------------------------------------------------
create table if not exists friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references profiles(id) on delete cascade,
  addressee_id  uuid not null references profiles(id) on delete cascade,
  status        text not null check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  constraint no_self_friendship check (requester_id <> addressee_id),
  constraint unique_pair unique (requester_id, addressee_id)
);

alter table friendships enable row level security;

drop policy if exists "friendships_select_involved" on friendships;
create policy "friendships_select_involved" on friendships
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "friendships_insert_own_request" on friendships;
create policy "friendships_insert_own_request" on friendships
  for insert with check (auth.uid() = requester_id and status = 'pending');

-- Only the addressee may accept; either side may update to remove/decline
-- (declining/removing is implemented as a delete, see below).
drop policy if exists "friendships_update_addressee_accepts" on friendships;
create policy "friendships_update_addressee_accepts" on friendships
  for update
  using (auth.uid() = addressee_id)
  with check (status in ('accepted'));

drop policy if exists "friendships_delete_involved" on friendships;
create policy "friendships_delete_involved" on friendships
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ---------------------------------------------------------------------------
-- highscores  (goal_duel / market_value_duel / assist_duel / transfer_duel / guess_the_year)
-- ---------------------------------------------------------------------------
create table if not exists highscores (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references profiles(id) on delete cascade,
  game_type     text not null check (
    game_type in ('goal_duel', 'market_value_duel', 'assist_duel', 'transfer_duel', 'guess_the_year')
  ),
  score         integer not null check (score >= 0 and score <= 1000000),
  created_at    timestamptz not null default now()
);

-- Raised from the original 1000 ceiling: the Higher/Lower duels now use a
-- streak multiplier (see HigherLowerGame.jsx), so a long run legitimately
-- exceeds 1000 points. `create table if not exists` above won't touch this
-- constraint on an already-existing table, hence the explicit alter.
alter table highscores drop constraint if exists highscores_score_check;
alter table highscores add constraint highscores_score_check check (score >= 0 and score <= 1000000);

alter table highscores enable row level security;

drop policy if exists "highscores_select_public" on highscores;
create policy "highscores_select_public" on highscores
  for select using (true);

drop policy if exists "highscores_insert_own" on highscores;
create policy "highscores_insert_own" on highscores
  for insert with check (auth.uid() = user_id);

-- No update/delete policy: a submitted score is immutable (the "current
-- highscore" is simply the MAX(score) per user/game_type at query time).

create index if not exists idx_highscores_leaderboard on highscores (game_type, score desc);

-- ---------------------------------------------------------------------------
-- daily_challenges - the Daily Top 10 category content itself.
--
-- Deliberately its own table (not a static frontend JSON file): RLS hides
-- any row whose date is still in the future from every client, so a
-- tomorrow's answers can never leak through the compiled bundle or the
-- network tab (see 7.9). Only a service-role seed script may write rows.
-- ---------------------------------------------------------------------------
create table if not exists daily_challenges (
  date              date primary key,
  title             text not null,
  entries           jsonb not null, -- [{ rank, name }, ...] length 10 (no stat value shown to players)
  sort_hint         text, -- italic UI hint, e.g. "Sorted by career goals, highest to lowest"
  source_primary    text,
  source_secondary  text,
  verified_date     date,
  question_type     text not null default 'player' check (question_type in ('player', 'club')),
  constraint entries_has_ten check (jsonb_array_length(entries) = 10)
);

alter table daily_challenges add column if not exists sort_hint text;
-- `question_type` tells the client which name pool to search against: a
-- 'player' day's entries are player names, a 'club' day's entries are club
-- names - the two pools are kept strictly separate client-side (DailyTop10.jsx)
-- so a player question never suggests a club and vice versa.
alter table daily_challenges add column if not exists question_type text not null default 'player';
alter table daily_challenges drop constraint if exists daily_challenges_question_type_check;
alter table daily_challenges add constraint daily_challenges_question_type_check check (question_type in ('player', 'club'));

alter table daily_challenges enable row level security;

-- "Today" rolls over at midnight in Germany's timezone (CET/CEST), not UTC
-- midnight - the IANA zone name keeps this correct across the DST
-- transition automatically. Every other "today" boundary in this schema
-- (attempt ranking, streaks) uses the same zone for consistency.
drop policy if exists "daily_challenges_select_available" on daily_challenges;
create policy "daily_challenges_select_available" on daily_challenges
  for select using (date <= (timezone('Europe/Berlin', now()))::date);

-- No insert/update/delete policy for anon/authenticated roles: content is
-- seeded exclusively via the service-role key (see scripts/seed-daily.md).

-- ---------------------------------------------------------------------------
-- daily_attempts
-- ---------------------------------------------------------------------------
create table if not exists daily_attempts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references profiles(id) on delete cascade,
  challenge_date    date not null,
  attempted_at      timestamptz not null default now(),
  lives_remaining   integer not null check (lives_remaining between 0 and 3),
  found_count       integer not null check (found_count between 0 and 10),
  completed         boolean not null default false,
  is_ranked         boolean not null default false,
  points_earned     integer
);

alter table daily_attempts enable row level security;

drop policy if exists "daily_attempts_select_public" on daily_attempts;
create policy "daily_attempts_select_public" on daily_attempts
  for select using (true);

drop policy if exists "daily_attempts_insert_own" on daily_attempts;
create policy "daily_attempts_insert_own" on daily_attempts
  for insert with check (auth.uid() = user_id);

-- No update/update policy at all: an attempt is final once inserted (7.2).

-- Exactly one RANKED attempt per user per calendar day. Archive/unranked
-- replays are intentionally excluded from this constraint (3.8, 6.5).
create unique index if not exists uniq_ranked_attempt_per_day
  on daily_attempts (user_id, challenge_date)
  where (is_ranked = true);

create index if not exists idx_daily_attempts_leaderboard
  on daily_attempts (user_id) where is_ranked and completed;

-- `is_ranked` = true only if the attempt happens ON the challenge's own
-- calendar day, compared against the *server* clock - never the client's,
-- so spoofing the device time can't fabricate a ranked run (7.9, 6.5).
-- `points_earned` is derived here too, for the same anti-cheat reason:
-- the client never gets to assert its own point value.
create or replace function set_daily_attempt_ranking()
returns trigger as $$
begin
  new.is_ranked := (new.challenge_date = (timezone('Europe/Berlin', new.attempted_at))::date);

  if new.is_ranked and new.completed then
    new.points_earned := case new.lives_remaining
      when 3 then 100
      when 2 then 70
      when 1 then 40
      else 0
    end;
  else
    new.points_earned := 0;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create or replace trigger trg_set_daily_attempt_ranking
  before insert on daily_attempts
  for each row execute function set_daily_attempt_ranking();

-- ---------------------------------------------------------------------------
-- minefield_challenges - the day's Minefield category (16 tiles), same
-- future-hiding pattern as daily_challenges (7.9): RLS hides tomorrow's
-- category until its own calendar day arrives.
--
-- Minefield started out explicitly unranked/stateless (no DB at all). Per a
-- later, more specific request it now mirrors Daily Top 10: one category a
-- day, a day-picker for the last 16 days, and the *first* play of *today's*
-- category counts as ranked - replays of past days never do.
-- ---------------------------------------------------------------------------
create table if not exists minefield_challenges (
  date                  date primary key,
  title                 text not null,
  criteria_description  text,
  tiles                 jsonb not null, -- [{ name, meets_criteria, actual_value }, ...] length 16, 10 true/6 false
  source                text,
  verified_date         date,
  constraint tiles_has_sixteen check (jsonb_array_length(tiles) = 16)
);

alter table minefield_challenges enable row level security;

drop policy if exists "minefield_challenges_select_available" on minefield_challenges;
create policy "minefield_challenges_select_available" on minefield_challenges
  for select using (date <= (timezone('Europe/Berlin', now()))::date);

-- No insert/update/delete policy for anon/authenticated roles - seeded via
-- the service-role key or the SQL Editor, same as daily_challenges.

-- ---------------------------------------------------------------------------
-- minefield_attempts - mirrors daily_attempts exactly (see its comments).
-- ---------------------------------------------------------------------------
create table if not exists minefield_attempts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references profiles(id) on delete cascade,
  challenge_date    date not null,
  attempted_at      timestamptz not null default now(),
  bombs_hit         integer not null check (bombs_hit between 0 and 6),
  safe_found        integer not null check (safe_found between 0 and 10),
  completed         boolean not null default false,
  is_ranked         boolean not null default false,
  points_earned     integer
);

alter table minefield_attempts enable row level security;

drop policy if exists "minefield_attempts_select_public" on minefield_attempts;
create policy "minefield_attempts_select_public" on minefield_attempts
  for select using (true);

drop policy if exists "minefield_attempts_insert_own" on minefield_attempts;
create policy "minefield_attempts_insert_own" on minefield_attempts
  for insert with check (auth.uid() = user_id);

create unique index if not exists uniq_ranked_minefield_attempt_per_day
  on minefield_attempts (user_id, challenge_date)
  where (is_ranked = true);

create index if not exists idx_minefield_attempts_leaderboard
  on minefield_attempts (user_id) where is_ranked and completed;

-- Same anti-cheat pattern as Daily Top 10: is_ranked and points_earned are
-- computed server-side from the server clock, never trusted from the client.
-- Points formula (our own default - not specified elsewhere): fewer bombs
-- hit while still clearing all 10 safe tiles scores higher.
create or replace function set_minefield_attempt_ranking()
returns trigger as $$
begin
  new.is_ranked := (new.challenge_date = (timezone('Europe/Berlin', new.attempted_at))::date);

  if new.is_ranked and new.completed then
    new.points_earned := case
      when new.bombs_hit = 0 then 100
      when new.bombs_hit = 1 then 85
      when new.bombs_hit = 2 then 70
      when new.bombs_hit = 3 then 55
      when new.bombs_hit = 4 then 40
      else 25 -- 5 bombs is the most you can hit and still clear it
    end;
  else
    new.points_earned := 0;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create or replace trigger trg_set_minefield_attempt_ranking
  before insert on minefield_attempts
  for each row execute function set_minefield_attempt_ranking();

-- ---------------------------------------------------------------------------
-- Account deletion (7.8 / GDPR) - cascades already drop friendships,
-- highscores, daily_attempts and minefield_attempts via ON DELETE CASCADE
-- on user_id/profiles.id.
-- Deleting the auth.users row itself needs elevated rights, hence
-- SECURITY DEFINER; it only ever deletes auth.uid()'s own account.
-- ---------------------------------------------------------------------------
create or replace function delete_own_account()
returns void as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$ language plpgsql security definer;

revoke all on function delete_own_account() from public;
grant execute on function delete_own_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboard helper views (6.4). Both underlying tables already have
-- public SELECT policies, so these views expose nothing new.
-- ---------------------------------------------------------------------------
create or replace view best_highscores as
  select user_id, game_type, max(score) as score
  from highscores
  where user_id is not null
  group by user_id, game_type;

create or replace view daily_top10_alltime as
  select user_id, sum(points_earned) as total_points
  from daily_attempts
  where user_id is not null and is_ranked and completed
  group by user_id;

-- Current consecutive-day ranked-win streak (counts back from today, or
-- from yesterday if today hasn't been played yet - an unplayed "today"
-- doesn't break a streak until the day is actually over).
create or replace function get_current_streak(target_user uuid)
returns integer as $$
declare
  streak integer := 0;
  d date := (timezone('Europe/Berlin', now()))::date;
begin
  if not exists (
    select 1 from daily_attempts
    where user_id = target_user and challenge_date = d and is_ranked and completed
  ) then
    d := d - 1;
  end if;

  loop
    exit when not exists (
      select 1 from daily_attempts
      where user_id = target_user and challenge_date = d and is_ranked and completed
    );
    streak := streak + 1;
    d := d - 1;
  end loop;

  return streak;
end;
$$ language plpgsql stable;

grant execute on function get_current_streak(uuid) to authenticated, anon;

-- Longest streak ever achieved (classic gaps-and-islands over ranked wins).
create or replace function get_longest_streak(target_user uuid)
returns integer as $$
  select coalesce(max(streak_len), 0)::integer from (
    select count(*) as streak_len
    from (
      select challenge_date,
             challenge_date - (row_number() over (order by challenge_date))::int as grp
      from daily_attempts
      where user_id = target_user and is_ranked and completed
    ) grouped
    group by grp
  ) streaks;
$$ language sql stable;

grant execute on function get_longest_streak(uuid) to authenticated, anon;

-- Same two views/functions again for Minefield now that it's ranked too.
create or replace view minefield_alltime as
  select user_id, sum(points_earned) as total_points
  from minefield_attempts
  where user_id is not null and is_ranked and completed
  group by user_id;

create or replace function get_current_minefield_streak(target_user uuid)
returns integer as $$
declare
  streak integer := 0;
  d date := (timezone('Europe/Berlin', now()))::date;
begin
  if not exists (
    select 1 from minefield_attempts
    where user_id = target_user and challenge_date = d and is_ranked and completed
  ) then
    d := d - 1;
  end if;

  loop
    exit when not exists (
      select 1 from minefield_attempts
      where user_id = target_user and challenge_date = d and is_ranked and completed
    );
    streak := streak + 1;
    d := d - 1;
  end loop;

  return streak;
end;
$$ language plpgsql stable;

grant execute on function get_current_minefield_streak(uuid) to authenticated, anon;

create or replace function get_longest_minefield_streak(target_user uuid)
returns integer as $$
  select coalesce(max(streak_len), 0)::integer from (
    select count(*) as streak_len
    from (
      select challenge_date,
             challenge_date - (row_number() over (order by challenge_date))::int as grp
      from minefield_attempts
      where user_id = target_user and is_ranked and completed
    ) grouped
    group by grp
  ) streaks;
$$ language sql stable;

grant execute on function get_longest_minefield_streak(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Streak + Freeze system - shared freeze currency across Daily Top 10 and
-- Minefield; each game keeps its own streak counter, but a freeze earned in
-- either game can save either game's streak from breaking.
--
-- Daily Top 10's `found_count` (0-10) on a RANKED attempt has three bands:
--   0-4  -> breaks the streak, but only after a 24h grace window in which a
--           banked freeze can be spent to save it (spend_freeze()).
--   5-6  -> holds the streak (counts the day as played, doesn't grow it).
--   7-10 -> grows the streak by 1; a perfect 10/10 also banks a freeze.
--
-- Minefield has no partial-credit tier (its result is a plain win/lose), so
-- it only ever uses 'break' or 'increase': a loss breaks (with the same 24h
-- freeze-save window), a win grows the streak, and a perfect 0-bomb win also
-- banks a freeze.
--
-- This can't be derived purely from attempt history the way the old
-- get_current_streak()/get_current_minefield_streak() above are (a frozen
-- day has no "qualifying" attempt to find in hindsight), so it needs real
-- persisted state - streak_state - updated by a trigger on every ranked
-- attempt insert.
-- ---------------------------------------------------------------------------
create table if not exists streak_freezes (
  user_id   uuid primary key references profiles(id) on delete cascade,
  balance   integer not null default 0 check (balance between 0 and 3)
);

alter table streak_freezes enable row level security;

drop policy if exists "streak_freezes_select_own" on streak_freezes;
create policy "streak_freezes_select_own" on streak_freezes
  for select using (auth.uid() = user_id);

-- No insert/update policy for clients - balance only ever changes through
-- the security-definer functions below (anti-cheat: never trust a
-- client-submitted freeze count).

create table if not exists streak_state (
  user_id              uuid not null references profiles(id) on delete cascade,
  game                 text not null check (game in ('daily_top10', 'minefield')),
  current_streak       integer not null default 0,
  longest_streak       integer not null default 0,
  perfect_count        integer not null default 0, -- perfect (10/10) days within current_streak - the "(M)" in "Streak N (M)"
  last_counted_date    date,        -- last calendar date (CET) that counted toward current_streak (played or frozen)
  pending_break_date   date,        -- the date whose bad result would break the streak if not frozen in time
  pending_break_at     timestamptz, -- when that pending break was recorded; +24h is the freeze deadline
  primary key (user_id, game)
);

alter table streak_state enable row level security;

drop policy if exists "streak_state_select_public" on streak_state;
create policy "streak_state_select_public" on streak_state
  for select using (true); -- shown on dashboards/leaderboards, same visibility as highscores

-- No insert/update policy for clients - written exclusively by the
-- security-definer functions below.

-- Core state machine, shared by the trigger (new ranked result) and
-- spend_freeze (saving a pending break). Resolves any already-stale pending
-- break first (the 24h window lapsed with nobody spending a freeze on it),
-- then applies the new result's band.
create or replace function bump_streak(
  p_user_id uuid,
  p_game text,
  p_challenge_date date,
  p_band text, -- 'break' | 'hold' | 'increase'
  p_perfect boolean
)
returns void as $$
declare
  st streak_state;
  gap_days integer;
begin
  insert into streak_state (user_id, game) values (p_user_id, p_game)
  on conflict (user_id, game) do nothing;

  select * into st from streak_state where user_id = p_user_id and game = p_game for update;

  -- A still-open pending break means the player moved on to a new ranked day
  -- without using the freeze-save window - finalize it as broken now rather
  -- than layer today's result on top of an undecided one.
  if st.pending_break_at is not null then
    st.current_streak := 0;
    st.perfect_count := 0;
  end if;

  gap_days := case when st.last_counted_date is null then 0
                    else p_challenge_date - st.last_counted_date - 1 end;
  if gap_days > 0 then
    -- A day (or more) was skipped entirely before this one - no popup for a
    -- day that already passed unnoticed, it just breaks the streak.
    st.current_streak := 0;
    st.perfect_count := 0;
  end if;

  if p_band = 'break' then
    update streak_state
    set current_streak = st.current_streak,
        perfect_count = st.perfect_count,
        pending_break_date = p_challenge_date,
        pending_break_at = now()
    where user_id = p_user_id and game = p_game;
  elsif p_band = 'hold' then
    update streak_state
    set current_streak = st.current_streak,
        perfect_count = st.perfect_count,
        last_counted_date = p_challenge_date,
        pending_break_date = null,
        pending_break_at = null
    where user_id = p_user_id and game = p_game;
  else -- increase
    update streak_state
    set current_streak = st.current_streak + 1,
        longest_streak = greatest(st.longest_streak, st.current_streak + 1),
        perfect_count = st.perfect_count + (case when p_perfect then 1 else 0 end),
        last_counted_date = p_challenge_date,
        pending_break_date = null,
        pending_break_at = null
    where user_id = p_user_id and game = p_game;
  end if;

  if p_perfect then
    insert into streak_freezes (user_id, balance) values (p_user_id, 1)
    on conflict (user_id) do update set balance = least(3, streak_freezes.balance + 1);
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function trg_daily_attempt_streak()
returns trigger as $$
declare
  band text;
begin
  if new.is_ranked then
    if new.found_count <= 4 then band := 'break';
    elsif new.found_count <= 6 then band := 'hold';
    else band := 'increase';
    end if;
    perform bump_streak(new.user_id, 'daily_top10', new.challenge_date, band, new.found_count = 10);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_daily_attempts_streak on daily_attempts;
create trigger trg_daily_attempts_streak
  after insert on daily_attempts
  for each row execute function trg_daily_attempt_streak();

-- Minefield's result is win/lose, not a 0-10 scale, so it only ever uses the
-- 'break'/'increase' bands (no 'hold' tier) - but otherwise goes through the
-- exact same streak_state/freeze machinery as Daily Top 10 above.
create or replace function trg_minefield_attempt_streak()
returns trigger as $$
declare
  band text;
begin
  if new.is_ranked then
    band := case when new.completed then 'increase' else 'break' end;
    perform bump_streak(new.user_id, 'minefield', new.challenge_date, band, new.completed and new.bombs_hit = 0);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_minefield_attempts_perfect_freeze on minefield_attempts;
drop trigger if exists trg_minefield_attempts_streak on minefield_attempts;
create trigger trg_minefield_attempts_streak
  after insert on minefield_attempts
  for each row execute function trg_minefield_attempt_streak();

-- Spends one banked freeze to save a currently-pending break (see
-- bump_streak above). Returns false (no-op) if there's nothing to save, the
-- 24h window already lapsed, or the balance is empty - the client treats any
-- of those as "couldn't save it" without needing to distinguish why.
create or replace function spend_freeze(p_game text)
returns boolean as $$
declare
  uid uuid := auth.uid();
  st streak_state;
  bal integer;
begin
  if uid is null or p_game not in ('daily_top10', 'minefield') then
    return false;
  end if;

  select * into st from streak_state where user_id = uid and game = p_game for update;
  if not found or st.pending_break_at is null or st.pending_break_at <= now() - interval '24 hours' then
    return false;
  end if;

  select balance into bal from streak_freezes where user_id = uid for update;
  if bal is null or bal < 1 then
    return false;
  end if;

  update streak_freezes set balance = balance - 1 where user_id = uid;
  update streak_state
  set last_counted_date = st.pending_break_date,
      pending_break_date = null,
      pending_break_at = null
  where user_id = uid and game = p_game;

  return true;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function spend_freeze(text) from public;
grant execute on function spend_freeze(text) to authenticated;

-- Read helper: resolves an expired pending break (24h lapsed, nobody spent a
-- freeze) before returning the row, so a stale "about to break" state never
-- lingers just because nobody happened to trigger a write. Callable for any
-- user_id (not just auth.uid()) so it also powers friend dashboards and
-- leaderboards, same visibility as streak_state's own public select policy.
create or replace function get_streak(p_user_id uuid, p_game text)
returns streak_state as $$
declare
  result streak_state;
begin
  update streak_state
  set current_streak = 0, perfect_count = 0, pending_break_date = null, pending_break_at = null
  where user_id = p_user_id and game = p_game
    and pending_break_at is not null and pending_break_at <= now() - interval '24 hours';

  select * into result from streak_state where user_id = p_user_id and game = p_game;
  if not found then
    result.user_id := p_user_id;
    result.game := p_game;
    result.current_streak := 0;
    result.longest_streak := 0;
    result.perfect_count := 0;
  end if;

  return result;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function get_streak(uuid, text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Username search (6.3 / 7.4) - search by username only, never by email;
-- a thin wrapper keeps the query pattern consistent and rate-limitable.
-- ---------------------------------------------------------------------------
create or replace function search_profiles(query text)
returns setof profiles as $$
  select * from profiles
  where username ilike query || '%'
  order by username
  limit 20;
$$ language sql stable security definer;

revoke all on function search_profiles(text) from public;
grant execute on function search_profiles(text) to authenticated, anon;
