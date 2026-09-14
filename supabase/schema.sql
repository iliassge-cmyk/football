-- =============================================================================
-- TopXI — Supabase schema, RLS policies, triggers
-- Run against a fresh Supabase project (SQL Editor, or `supabase db push`).
--
-- Genuinely safe to paste and re-run in full any time this file changes
-- (e.g. after a feature adds new tables): every statement is idempotent —
-- tables/indexes/views/functions use IF NOT EXISTS / OR REPLACE, and every
-- policy is preceded by a matching `drop policy if exists` since Postgres
-- has no `CREATE POLICY IF NOT EXISTS`. (An earlier version of this file
-- was NOT actually idempotent for policies/triggers — re-pasting it after
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
  score         integer not null check (score >= 0 and score <= 1000),
  created_at    timestamptz not null default now()
);

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
-- daily_challenges — the Daily Top 10 category content itself.
--
-- Deliberately its own table (not a static frontend JSON file): RLS hides
-- any row whose date is still in the future from every client, so a
-- tomorrow's answers can never leak through the compiled bundle or the
-- network tab (see 7.9). Only a service-role seed script may write rows.
-- ---------------------------------------------------------------------------
create table if not exists daily_challenges (
  date              date primary key,
  title             text not null,
  entries           jsonb not null, -- [{ rank, name, value }, ...] length 10
  source_primary    text,
  source_secondary  text,
  verified_date     date,
  constraint entries_has_ten check (jsonb_array_length(entries) = 10)
);

alter table daily_challenges enable row level security;

drop policy if exists "daily_challenges_select_available" on daily_challenges;
create policy "daily_challenges_select_available" on daily_challenges
  for select using (date <= (timezone('utc', now()))::date);

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
-- calendar day, compared against the *server* clock — never the client's,
-- so spoofing the device time can't fabricate a ranked run (7.9, 6.5).
-- `points_earned` is derived here too, for the same anti-cheat reason:
-- the client never gets to assert its own point value.
create or replace function set_daily_attempt_ranking()
returns trigger as $$
begin
  new.is_ranked := (new.challenge_date = (timezone('utc', new.attempted_at))::date);

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
-- minefield_challenges — the day's Minefield category (16 tiles), same
-- future-hiding pattern as daily_challenges (7.9): RLS hides tomorrow's
-- category until its own calendar day arrives.
--
-- Minefield started out explicitly unranked/stateless (no DB at all). Per a
-- later, more specific request it now mirrors Daily Top 10: one category a
-- day, a day-picker for the last 16 days, and the *first* play of *today's*
-- category counts as ranked — replays of past days never do.
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
  for select using (date <= (timezone('utc', now()))::date);

-- No insert/update/delete policy for anon/authenticated roles — seeded via
-- the service-role key or the SQL Editor, same as daily_challenges.

-- ---------------------------------------------------------------------------
-- minefield_attempts — mirrors daily_attempts exactly (see its comments).
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
-- Points formula (our own default — not specified elsewhere): fewer bombs
-- hit while still clearing all 10 safe tiles scores higher.
create or replace function set_minefield_attempt_ranking()
returns trigger as $$
begin
  new.is_ranked := (new.challenge_date = (timezone('utc', new.attempted_at))::date);

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
-- Account deletion (7.8 / GDPR) — cascades already drop friendships,
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
-- from yesterday if today hasn't been played yet — an unplayed "today"
-- doesn't break a streak until the day is actually over).
create or replace function get_current_streak(target_user uuid)
returns integer as $$
declare
  streak integer := 0;
  d date := (timezone('utc', now()))::date;
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
  d date := (timezone('utc', now()))::date;
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
-- Username search (6.3 / 7.4) — search by username only, never by email;
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
