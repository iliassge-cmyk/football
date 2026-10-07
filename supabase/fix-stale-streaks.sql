-- Fix: a streak must be gone once a whole day was skipped (it was only reset when the player came back).
-- 1) get_streak() now resets such streaks on read (used by the dashboard).
-- 2) one-off clean-up of every row that is stale today (e.g. ArdaGueler: last counted 2026-10-02, still showed streak 1).
-- Safe to re-run. Paste the whole file into the Supabase SQL Editor.

create or replace function get_streak(p_user_id uuid, p_game text)
returns streak_state as $$
declare
  result streak_state;
begin
  update streak_state
  set current_streak = 0, perfect_count = 0, pending_break_date = null, pending_break_at = null
  where user_id = p_user_id and game = p_game
    and pending_break_at is not null and pending_break_at <= now() - interval '24 hours';

  -- A whole day skipped without a pending break (the player just stopped playing): the streak is gone. It stays alive while
  -- the last counted day is yesterday or today, because today's challenge can still be played.
  update streak_state
  set current_streak = 0, perfect_count = 0
  where user_id = p_user_id and game = p_game
    and current_streak > 0 and pending_break_at is null
    and last_counted_date is not null
    and last_counted_date < (timezone('Europe/Berlin', now()))::date - 1;

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

update streak_state
set current_streak = 0, perfect_count = 0
where current_streak > 0 and pending_break_at is null
  and last_counted_date is not null
  and last_counted_date < (timezone('Europe/Berlin', now()))::date - 1;
