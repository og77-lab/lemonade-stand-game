-- לימונדה בע״מ: neighborhood mode (multiplayer). Up to 10 stands on one street, one real day per game day.
-- Run once in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
-- Times are Israel time. Stands are open 08:00–17:00; between days (17:00–07:59) everyone decides for tomorrow.
-- The days themselves are run by the Edge Function lm-hood-tick (supabase/functions/lm-hood-tick), called every few minutes by pg_cron (step 9).

-- 1. Tables. Row level security is on with no policies: players reach them only through the functions below.
create table if not exists public.lm_hoods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- 6 letters/digits to join with
  name text not null check (char_length(name) between 2 and 24),
  owner uuid not null references auth.users(id) on delete cascade,
  seed int not null,                               -- secret: it decides the weather and the events
  days int not null check (days in (7, 14)),
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  size int not null check (size between 2 and 10), -- stands on the street
  start_date date not null,                        -- day 1 (Israel date)
  last_day int not null default 0,                 -- last day the server has run
  status text not null default 'open' check (status in ('open','running','done')),
  created_at timestamptz not null default now()
);
create table if not exists public.lm_members (
  id uuid primary key default gen_random_uuid(),
  hood uuid not null references public.lm_hoods(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, -- null: a bot
  slot int not null,
  nick text not null,
  em text not null default '🍋',
  persona text,                                    -- the bot's character (null for players)
  state jsonb not null,                            -- cash, stock, reputation, upgrades, loan, score (private)
  joined_at timestamptz not null default now(),
  unique (hood, slot)
);
create unique index if not exists lm_members_one_per_user on public.lm_members(hood, user_id) where user_id is not null;
create table if not exists public.lm_decisions (
  member uuid not null references public.lm_members(id) on delete cascade,
  day int not null,
  dec jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (member, day)
);
create table if not exists public.lm_intel (        -- the evening market before each day, and its forecasts (written by the server)
  hood uuid not null references public.lm_hoods(id) on delete cascade,
  day int not null,
  data jsonb not null,
  primary key (hood, day)
);
create table if not exists public.lm_bought (       -- forecasts bought: paid at once, seen at once
  member uuid not null references public.lm_members(id) on delete cascade,
  day int not null,
  lv int not null check (lv between 1 and 3),
  cost numeric not null,
  primary key (member, day)
);
create table if not exists public.lm_days (         -- each day as the server ran it
  hood uuid not null references public.lm_hoods(id) on delete cascade,
  day int not null,
  open jsonb not null,     -- seen from 08:00: weather, street event, every stand's price, place and upgrades
  events jsonb not null,   -- the day's moments, each with its minute; seen once their time has come
  results jsonb not null,  -- seen from 17:00
  ran_at timestamptz not null default now(),
  primary key (hood, day)
);
create table if not exists public.lm_member_days (  -- what only the stand's owner sees about its day
  member uuid not null references public.lm_members(id) on delete cascade,
  day int not null,
  data jsonb not null,
  primary key (member, day)
);
alter table public.lm_hoods enable row level security;
alter table public.lm_members enable row level security;
alter table public.lm_decisions enable row level security;
alter table public.lm_intel enable row level security;
alter table public.lm_bought enable row level security;
alter table public.lm_days enable row level security;
alter table public.lm_member_days enable row level security;

-- 2. Time helpers: Israel time, and the minute a game day's stands open
create or replace function public.lm_local() returns timestamp language sql stable as $$ select now() at time zone 'Asia/Jerusalem' $$;
create or replace function public.lm_open_at(h public.lm_hoods, d int) returns timestamp language sql stable as $$
  select (h.start_date + (d - 1))::timestamp + time '08:00' $$;
-- the day players are deciding for right now (between days), or null while the stands are open / after the game
create or replace function public.lm_deciding(h public.lm_hoods) returns int language plpgsql stable as $$
declare t timestamp := public.lm_local(); d int;
begin
  for d in 1..h.days loop
    if t < public.lm_open_at(h, d) then
      if d = 1 or t >= public.lm_open_at(h, d - 1) + interval '9 hours' then return d; end if;
      return null; -- day d-1 is still selling
    end if;
  end loop;
  return null;
end $$;

create or replace function public.lm_new_stand() returns jsonb language sql immutable as $$
  select '{"cash":80,"lemons":[{"q":40,"d":1}],"sugar":0,"ice":0,"rep":50,"ups":[],"loan":0,"tot":0,"tricks":0,"paper":false}'::jsonb $$;
create or replace function public.lm_me(p_hood uuid) returns public.lm_members language sql stable security definer set search_path = public as $$
  select * from lm_members where hood = p_hood and user_id = auth.uid() $$;
revoke all on function public.lm_me(uuid) from public, anon;

-- 3. Create a neighborhood. Empty stands are filled with the game's characters (bots) when p_bots; players who join take their place.
create or replace function public.lm_hood_create(p_name text, p_nick text, p_days int, p_difficulty text, p_size int, p_bots boolean, p_start date default null)
returns json language plpgsql security definer set search_path = public as $$
declare h lm_hoods; c text; k int; personas text[] := array['budget','premium','steady','trendy','gambler','veteran'];
  names text[] := array['אבי הזול','שף מוריס','דוד יוסי','נועה הטרנדית','מוטי המהמר','סבתא רחל'];
  ems text[] := array['💸','👨‍🍳','🧓','😎','🎲','👵']; recent int; start date;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_nick is null or char_length(btrim(p_nick)) not between 2 and 16 then raise exception 'bad nickname'; end if;
  select count(*) into recent from lm_hoods where owner = auth.uid() and created_at > now() - interval '1 day';
  if recent >= 5 then raise exception 'too many neighborhoods'; end if;
  -- day 1 is tomorrow unless asked otherwise (today only if the stands haven't opened yet)
  start := coalesce(p_start, (lm_local() + interval '16 hours')::date);
  if start < lm_local()::date or (start = lm_local()::date and lm_local()::time >= time '08:00') or start > lm_local()::date + 14 then raise exception 'bad start date'; end if;
  loop
    c := upper(translate(substr(md5(random()::text || clock_timestamp()::text), 1, 6), '01', 'kz')); -- no 0/1 to mix up with O/I
    exit when not exists (select 1 from lm_hoods where code = c);
  end loop;
  insert into lm_hoods(code, name, owner, seed, days, difficulty, size, start_date)
    values (c, btrim(p_name), auth.uid(), floor(random() * 100000)::int, p_days, p_difficulty, p_size, start) returning * into h;
  insert into lm_members(hood, user_id, slot, nick, state) values (h.id, auth.uid(), 0, btrim(p_nick), lm_new_stand());
  if p_bots then
    for k in 1..p_size - 1 loop
      insert into lm_members(hood, slot, nick, em, persona, state)
        values (h.id, k, names[1 + (k - 1) % 6] || case when k > 6 then ' ' || ((k - 1) / 6 + 1) else '' end, ems[1 + (k - 1) % 6], personas[1 + (k - 1) % 6], lm_new_stand());
    end loop;
  end if;
  return json_build_object('id', h.id, 'code', h.code, 'start', h.start_date);
end $$;

-- 4. Join with a code, until the stands open on day 1. A player takes a bot's stand, or a free one.
create or replace function public.lm_hood_join(p_code text, p_nick text) returns json language plpgsql security definer set search_path = public as $$
declare h lm_hoods; b lm_members; n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_nick is null or char_length(btrim(p_nick)) not between 2 and 16 then raise exception 'bad nickname'; end if;
  select * into h from lm_hoods where code = upper(btrim(p_code)) for update;
  if not found then raise exception 'no such neighborhood'; end if;
  if exists (select 1 from lm_members where hood = h.id and user_id = auth.uid()) then return json_build_object('id', h.id); end if;
  if lm_local() >= lm_open_at(h, 1) then raise exception 'already started'; end if;
  select * into b from lm_members where hood = h.id and user_id is null order by slot desc limit 1;
  if found then
    update lm_members set user_id = auth.uid(), nick = btrim(p_nick), em = '🍋', persona = null, joined_at = now() where id = b.id;
  else
    select count(*) into n from lm_members where hood = h.id;
    if n >= h.size then raise exception 'neighborhood full'; end if;
    insert into lm_members(hood, user_id, slot, nick, state) values (h.id, auth.uid(), n, btrim(p_nick), lm_new_stand());
  end if;
  return json_build_object('id', h.id);
end $$;

-- 5. My neighborhoods
create or replace function public.lm_my_hoods() returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', h.id, 'name', h.name, 'code', h.code, 'days', h.days, 'start', h.start_date,
    'last_day', h.last_day, 'status', h.status, 'size', h.size) order by h.created_at desc), '[]'::json)
  from lm_hoods h join lm_members m on m.hood = h.id and m.user_id = auth.uid() $$;

-- 6. Everything a player may see right now
create or replace function public.lm_hood_state(p_hood uuid) returns json language plpgsql stable security definer set search_path = public as $$
declare h lm_hoods; me lm_members; t timestamp := lm_local(); dd int; today int; res json;
begin
  select * into me from lm_members where hood = p_hood and user_id = auth.uid();
  if not found then raise exception 'not a member'; end if;
  select * into h from lm_hoods where id = p_hood;
  dd := lm_deciding(h);
  -- the game day whose stands are open now (or were today)
  today := case when t >= lm_open_at(h, 1) then least(h.days, (t::date - h.start_date) + 1) else 0 end;
  select json_build_object(
    'hood', json_build_object('id', h.id, 'name', h.name, 'code', h.code, 'days', h.days, 'difficulty', h.difficulty, 'size', h.size,
      'start', h.start_date, 'last_day', h.last_day, 'status', h.status, 'owner', h.owner = auth.uid()),
    'now', t, 'deciding', dd, 'today', today,
    'members', (select json_agg(json_build_object('id', m.id, 'slot', m.slot, 'nick', m.nick, 'em', m.em, 'bot', m.user_id is null, 'me', m.id = me.id,
        'ready', dd is not null and exists (select 1 from lm_decisions x where x.member = m.id and x.day = dd)) order by m.slot)
      from lm_members m where m.hood = h.id),
    -- until 17:00 a stand looks as it did after the evening's purchases (the day's outcome is already stored)
    'me', json_build_object('id', me.id, 'state', coalesce((select x.data->'before' from lm_member_days x where x.member = me.id and x.day = h.last_day
               and t < lm_open_at(h, h.last_day) + interval '9 hours'), me.state),
      'decision', (select dec from lm_decisions where member = me.id and day = dd),
      -- my own plan for the day (recipe, price, cups, place) from the moment the stands open
      'plan', (select x.data->'plan' from lm_member_days x where x.member = me.id and x.day = h.last_day and t >= lm_open_at(h, h.last_day)),
      'forecast', (select json_build_object('lv', b.lv, 'data', i.data->'fc'->(b.lv::text)) from lm_bought b join lm_intel i on i.hood = h.id and i.day = b.day where b.member = me.id and b.day = dd),
      'days', (select json_object_agg(x.day, x.data) from lm_member_days x where x.member = me.id
               and t >= lm_open_at(h, x.day) + interval '9 hours')),
    'market', (select json_build_object('day', i.day, 'prices', i.data->'prices', 'mev', i.data->'mev') from lm_intel i where i.hood = h.id and i.day = dd),
    'opened', (select json_object_agg(x.day, x.open) from lm_days x where x.hood = h.id and t >= lm_open_at(h, x.day)),
    'results', (select json_object_agg(x.day, x.results) from lm_days x where x.hood = h.id and t >= lm_open_at(h, x.day) + interval '9 hours')
  ) into res;
  return res;
end $$;

-- 7. Save tonight's decisions (any number of times until 08:00). The server checks and pays for everything when it runs the day.
create or replace function public.lm_save_decision(p_hood uuid, p_day int, p_dec jsonb) returns json language plpgsql security definer set search_path = public as $$
declare h lm_hoods; me lm_members;
begin
  select * into me from lm_members where hood = p_hood and user_id = auth.uid();
  if not found then raise exception 'not a member'; end if;
  select * into h from lm_hoods where id = p_hood;
  if lm_deciding(h) is distinct from p_day then raise exception 'locked'; end if;
  if jsonb_typeof(p_dec) <> 'object' or length(p_dec::text) > 4000 then raise exception 'bad decision'; end if;
  insert into lm_decisions(member, day, dec) values (me.id, p_day, p_dec)
    on conflict (member, day) do update set dec = excluded.dec, saved_at = now();
  return json_build_object('ok', true, 'saved_at', now());
end $$;

-- 8. Buy a forecast for tomorrow: paid now, seen now. One per evening (a better one can't be bought on top).
create or replace function public.lm_buy_forecast(p_hood uuid, p_day int, p_lv int) returns json language plpgsql security definer set search_path = public as $$
declare h lm_hoods; me lm_members; i lm_intel; cost numeric;
begin
  select * into me from lm_members where hood = p_hood and user_id = auth.uid() for update;
  if not found then raise exception 'not a member'; end if;
  select * into h from lm_hoods where id = p_hood;
  if lm_deciding(h) is distinct from p_day then raise exception 'locked'; end if;
  if exists (select 1 from lm_bought where member = me.id and day = p_day) then raise exception 'already bought'; end if;
  select * into i from lm_intel where hood = p_hood and day = p_day;
  if not found then raise exception 'not ready'; end if;
  cost := case p_lv when 1 then 2 when 2 then 5 when 3 then 10 end;
  if cost is null then raise exception 'bad level'; end if;
  if (me.state->>'cash')::numeric < cost then raise exception 'not enough cash'; end if;
  update lm_members set state = jsonb_set(state, '{cash}', to_jsonb(round((state->>'cash')::numeric - cost, 2))) where id = me.id;
  insert into lm_bought(member, day, lv, cost) values (me.id, p_day, p_lv, cost);
  return i.data->'fc'->(p_lv::text);
end $$;

-- 9. The live street: the day's moments up to this minute (p_after: the last minute already seen)
create or replace function public.lm_feed(p_hood uuid, p_day int, p_after int default -1) returns json language plpgsql stable security definer set search_path = public as $$
declare h lm_hoods; t timestamp := lm_local(); m int;
begin
  if not exists (select 1 from lm_members where hood = p_hood and user_id = auth.uid()) then raise exception 'not a member'; end if;
  select * into h from lm_hoods where id = p_hood;
  if t < lm_open_at(h, p_day) then return '[]'::json; end if;
  m := least(1020, extract(epoch from (t - lm_open_at(h, p_day)))::int / 60 + 480);
  return (select coalesce(json_agg(e order by (e->>'m')::int), '[]'::json) from lm_days d, jsonb_array_elements(d.events) e
    where d.hood = p_hood and d.day = p_day and (e->>'m')::int <= m and (e->>'m')::int > p_after);
end $$;

-- 10. Who may call what
revoke all on function public.lm_hood_create(text, text, int, text, int, boolean, date) from public, anon;
revoke all on function public.lm_hood_join(text, text) from public, anon;
revoke all on function public.lm_my_hoods() from public, anon;
revoke all on function public.lm_hood_state(uuid) from public, anon;
revoke all on function public.lm_save_decision(uuid, int, jsonb) from public, anon;
revoke all on function public.lm_buy_forecast(uuid, int, int) from public, anon;
revoke all on function public.lm_feed(uuid, int, int) from public, anon;
grant execute on function public.lm_hood_create(text, text, int, text, int, boolean, date) to authenticated;
grant execute on function public.lm_hood_join(text, text) to authenticated;
grant execute on function public.lm_my_hoods() to authenticated;
grant execute on function public.lm_hood_state(uuid) to authenticated;
grant execute on function public.lm_save_decision(uuid, int, jsonb) to authenticated;
grant execute on function public.lm_buy_forecast(uuid, int, int) to authenticated;
grant execute on function public.lm_feed(uuid, int, int) to authenticated;

-- 11. Run the days: every 5 minutes pg_cron calls the Edge Function, which runs whatever is due (it does nothing otherwise).
--     Needs the pg_cron and pg_net extensions (Database → Extensions) and the function deployed first.
--     The call carries the project's public key (the same one the game uses), which passes the function's JWT check.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('lm-hood-tick') where exists (select 1 from cron.job where jobname = 'lm-hood-tick');
select cron.schedule('lm-hood-tick', '*/5 * * * *',
  $$ select net.http_post(url := 'https://xsnwsxhdqfcbhwujwgmr.supabase.co/functions/v1/lm-hood-tick', body := '{}'::jsonb,
       headers := '{"Content-Type":"application/json","apikey":"sb_publishable_GoNVy0V0T4F3hStcjXL3CQ_GvPqj4Vm","Authorization":"Bearer sb_publishable_GoNVy0V0T4F3hStcjXL3CQ_GvPqj4Vm"}'::jsonb) $$);
