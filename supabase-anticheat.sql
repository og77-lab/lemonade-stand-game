-- לימונדה בע״מ: server-side checks for the community records.
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- Safe to run again.

-- 1. Games are registered on the server when they start; the server picks the seed (no rerolling for good weather)
create table if not exists public.lm_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seed int not null,
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  competitors int not null check (competitors between 0 and 3),
  started_at timestamptz not null default now(),
  submitted boolean not null default false
);
alter table public.lm_games enable row level security; -- no policies: reachable only through the functions below

-- 2. Results remember which game they came from, and the day-by-day log (for checks and audits)
alter table public.game_results add column if not exists game_id uuid references public.lm_games(id) on delete set null;
alter table public.game_results add column if not exists log jsonb;
create unique index if not exists game_results_one_per_game on public.game_results(game_id) where game_id is not null;

-- 3. Players can no longer write results directly; only lm_submit can
drop policy if exists "Authenticated users can insert own results" on public.game_results;

-- 4. Nicknames: short (existing old-game names are left as they are)
do $$ begin
  alter table public.profiles add constraint profiles_username_len check (char_length(username) <= 16) not valid;
exception when duplicate_object then null; end $$;

-- 5. Start a game: returns the game id and its seed
create or replace function public.lm_start_game(p_difficulty text, p_competitors int)
returns json language plpgsql security definer set search_path = public as $$
declare gid uuid; s int; recent int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_difficulty not in ('easy','medium','hard') or p_competitors not between 0 and 3 then raise exception 'bad settings'; end if;
  select count(*) into recent from lm_games where user_id = auth.uid() and started_at > now() - interval '1 hour';
  if recent >= 30 then raise exception 'too many games'; end if;
  s := floor(random() * 100000)::int;
  insert into lm_games(user_id, seed, difficulty, competitors) values (auth.uid(), s, p_difficulty, p_competitors) returning id into gid;
  return json_build_object('id', gid, 'seed', s);
end $$;

-- 6. Submit a finished game: every number is checked before it reaches the board
create or replace function public.lm_submit(p_game uuid, p_nick text, p_score int, p_stars int, p_rep int, p_cups int, p_days jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare g lm_games; par numeric; st int; d jsonb; s_profit numeric := 0; s_sold int := 0; rk int; tot int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from lm_games where id = p_game and user_id = auth.uid() for update;
  if not found then raise exception 'unknown game'; end if;
  if g.submitted then raise exception 'already submitted'; end if;
  if now() - g.started_at < interval '60 seconds' then raise exception 'too fast'; end if;
  if now() - g.started_at > interval '2 days' then raise exception 'too old'; end if;
  if p_nick is null or char_length(btrim(p_nick)) not between 2 and 16 then raise exception 'bad nickname'; end if;
  if p_rep not between 0 and 100 or p_stars not between 1 and 5 or p_cups < 0 then raise exception 'bad values'; end if;
  if jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) <> 10 then raise exception 'bad log'; end if;
  for d in select * from jsonb_array_elements(p_days) loop
    if (d->>'sold')::int < 0 or (d->>'sold')::int > (d->>'cups')::int or (d->>'cups')::int > 999
       or (d->>'price')::numeric not between 1 and 20
       or abs((d->>'rev')::numeric - (d->>'sold')::int * (d->>'price')::numeric) > 0.5
       or (d->>'profit')::numeric > (d->>'rev')::numeric + 0.5
    then raise exception 'impossible day'; end if;
    s_profit := s_profit + (d->>'profit')::numeric;
    s_sold := s_sold + (d->>'sold')::int;
  end loop;
  if abs(s_profit - p_score) > 1.5 or s_sold <> p_cups then raise exception 'totals do not match'; end if;
  par := (case g.difficulty when 'easy' then array[1650,1350,1100,900] when 'medium' then array[1350,850,600,450] else array[1050,550,350,250] end)[g.competitors + 1];
  if p_score > par * 2.5 then raise exception 'score too high'; end if;
  st := case when p_score < 0 then 1 when p_score < par * 0.4 then 2 when p_score < par * 0.75 then 3 when p_score < par * 1.1 then 4 else 5 end;
  if st <> p_stars then raise exception 'stars do not match'; end if;
  update profiles set username = btrim(p_nick) where id = auth.uid();
  update lm_games set submitted = true where id = g.id;
  insert into game_results(user_id, score, difficulty, competitors, stars, reputation_final, cups_sold, game_id, log)
    values (auth.uid(), p_score, g.difficulty, g.competitors, p_stars, p_rep, p_cups, g.id, jsonb_build_object('seed', g.seed, 'days', p_days));
  select count(*) into rk from game_results where difficulty = g.difficulty and competitors = g.competitors and game_id is not null and score > p_score;
  select count(*) into tot from game_results where difficulty = g.difficulty and competitors = g.competitors and game_id is not null;
  return json_build_object('rank', rk + 1, 'total', tot);
end $$;

revoke all on function public.lm_start_game(text, int) from public, anon;
revoke all on function public.lm_submit(uuid, text, int, int, int, int, jsonb) from public, anon;
grant execute on function public.lm_start_game(text, int) to authenticated;
grant execute on function public.lm_submit(uuid, text, int, int, int, int, jsonb) to authenticated;

-- 7. Remove the connection test from 29.10.2026 (nickname "בדיקה", score 1)
delete from auth.users where id = 'a4dd9da5-f49b-4788-b95a-d373008efbf7';
