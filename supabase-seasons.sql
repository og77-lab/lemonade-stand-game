-- Seasons: when a league's days end, its season ends, not the street. The owner starts the next season (tomorrow, or after a few days' break)
-- or closes the street. Each season's final table is kept, so the street has its champions.
-- Run once in the SQL editor, after supabase-neighborhood.sql, supabase-leagues.sql and supabase-push.sql. Safe to run again.

alter table public.lm_hoods add column if not exists season int not null default 1;
alter table public.lm_hoods drop constraint if exists lm_hoods_status_check;
alter table public.lm_hoods add constraint lm_hoods_status_check check (status in ('open','running','done','closed'));
alter table public.lm_reminders drop constraint if exists lm_reminders_slot_check;
alter table public.lm_reminders add constraint lm_reminders_slot_check check (slot in ('evening','morning','season'));

create table if not exists public.lm_seasons (       -- each season's final table, kept after the street moves on
  hood uuid not null references public.lm_hoods(id) on delete cascade,
  season int not null,
  ended date not null,
  days int not null,
  board jsonb not null,                              -- [{id, nick, em, bot, score, rep, sold}], first place first
  primary key (hood, season)
);
alter table public.lm_seasons enable row level security;

-- the final table of the season now ending: the last day's scores, with names and the cups each sold over the season
create or replace function public.lm_season_board(h public.lm_hoods) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(x order by (x->>'score')::numeric desc), '[]'::jsonb) from (
    select jsonb_build_object('id', m.id, 'nick', m.nick, 'em', m.em, 'bot', m.user_id is null,
      'score', coalesce((select (e->>'score')::numeric from lm_days d, jsonb_array_elements(d.results) e where d.hood = h.id and d.day = h.last_day and e->>'id' = m.id::text), 0),
      'rep', coalesce((select (e->>'rep')::int from lm_days d, jsonb_array_elements(d.results) e where d.hood = h.id and d.day = h.last_day and e->>'id' = m.id::text), 50),
      'sold', coalesce((select sum((e->>'sold')::int) from lm_days d, jsonb_array_elements(d.results) e where d.hood = h.id and e->>'id' = m.id::text), 0)) x
    from lm_members m where m.hood = h.id) t $$;

-- keep the season that ended, once
create or replace function public.lm_season_keep(h public.lm_hoods) returns void language sql as $$
  insert into lm_seasons(hood, season, ended, days, board) values (h.id, h.season, lm_local()::date, h.days, lm_season_board(h))
  on conflict (hood, season) do nothing $$;

-- The owner starts the next season: the same street and the same players, everyone from nothing again. p_rest = days of break before day 1 (0 = tomorrow).
-- During the break friends can still join with the code, and the owner can change the length.
create or replace function public.lm_hood_next(p_hood uuid, p_rest int default 0, p_days int default null) returns json language plpgsql security definer set search_path = public as $$
declare h lm_hoods; start date;
begin
  select * into h from lm_hoods where id = p_hood for update;
  if not found or h.owner is distinct from auth.uid() then raise exception 'not the owner'; end if;
  if h.status <> 'done' then raise exception 'season not over'; end if;
  if p_rest is null or p_rest not between 0 and 7 then raise exception 'bad break'; end if;
  perform lm_season_keep(h);
  delete from lm_days where hood = h.id;
  delete from lm_intel where hood = h.id;
  delete from lm_reminders where hood = h.id and slot <> 'season';
  delete from lm_member_days where member in (select id from lm_members where hood = h.id);
  delete from lm_decisions where member in (select id from lm_members where hood = h.id);
  delete from lm_bought where member in (select id from lm_members where hood = h.id);
  delete from lm_records where member in (select id from lm_members where hood = h.id);
  delete from lm_spied where member in (select id from lm_members where hood = h.id);
  update lm_members set state = lm_new_stand() where hood = h.id;
  start := lm_local()::date + 1 + p_rest;
  update lm_hoods set season = h.season + 1, start_date = start, last_day = 0, status = 'open', seed = floor(random() * 100000)::int,
    days = coalesce(case when p_days in (7, 14) then p_days end, h.days) where id = h.id;
  return json_build_object('season', h.season + 1, 'start', start);
end $$;

-- The owner closes the street: the season is kept, and the street stays as an archive, without new days
create or replace function public.lm_hood_close(p_hood uuid) returns void language plpgsql security definer set search_path = public as $$
declare h lm_hoods;
begin
  select * into h from lm_hoods where id = p_hood for update;
  if not found or h.owner is distinct from auth.uid() then raise exception 'not the owner'; end if;
  if h.status <> 'done' then raise exception 'season not over'; end if;
  perform lm_season_keep(h);
  update lm_hoods set status = 'closed' where id = h.id;
end $$;

-- The street's seasons, for its members: the number of the one now, and the final tables of those that ended
create or replace function public.lm_hood_seasons(p_hood uuid) returns json language sql stable security definer set search_path = public as $$
  select json_build_object('season', h.season,
    'past', coalesce((select json_agg(json_build_object('season', s.season, 'ended', s.ended, 'days', s.days, 'board', s.board) order by s.season) from lm_seasons s where s.hood = h.id), '[]'::json))
  from lm_hoods h join lm_members m on m.hood = h.id and m.user_id = auth.uid() where h.id = p_hood $$;

-- My neighborhoods, with the season
create or replace function public.lm_my_hoods() returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', h.id, 'name', h.name, 'code', h.code, 'days', h.days, 'start', h.start_date,
    'last_day', h.last_day, 'status', h.status, 'size', h.size, 'owner', h.owner = auth.uid(), 'season', h.season) order by h.created_at desc), '[]'::json)
  from lm_hoods h join lm_members m on m.hood = h.id and m.user_id = auth.uid() $$;

revoke all on function public.lm_season_board(public.lm_hoods) from public, anon, authenticated;
revoke all on function public.lm_season_keep(public.lm_hoods) from public, anon, authenticated;
revoke all on function public.lm_hood_next(uuid, int, int) from public, anon;
revoke all on function public.lm_hood_close(uuid) from public, anon;
revoke all on function public.lm_hood_seasons(uuid) from public, anon;
grant execute on function public.lm_hood_next(uuid, int, int) to authenticated;
grant execute on function public.lm_hood_close(uuid) to authenticated;
grant execute on function public.lm_hood_seasons(uuid) to authenticated;
