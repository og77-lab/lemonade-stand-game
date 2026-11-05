-- The intel report: for ₪3 in the evening, what the street's stands did behind the counter on the last day (cup, cups made, security).
-- Prices, places, sales and marketing are open to everyone in the rivals dashboard; this is the part that costs money.
-- Run once in the SQL editor, after supabase-neighborhood.sql.

create table if not exists public.lm_spied (        -- reports bought: paid at once, kept for the rest of the season
  member uuid not null references public.lm_members(id) on delete cascade,
  day int not null,                                 -- the evening it was bought: before this game day (the report is about the day before it)
  cost numeric not null,
  data jsonb not null,
  primary key (member, day)
);
alter table public.lm_spied enable row level security;

create or replace function public.lm_buy_rivals(p_hood uuid, p_day int) returns json language plpgsql security definer set search_path = public as $$
declare h lm_hoods; me lm_members; old jsonb; res jsonb; cost numeric := 3;
begin
  select * into me from lm_members where hood = p_hood and user_id = auth.uid() for update;
  if not found then raise exception 'not a member'; end if;
  select * into h from lm_hoods where id = p_hood;
  if lm_deciding(h) is distinct from p_day or p_day < 2 then raise exception 'locked'; end if;
  select data into old from lm_spied where member = me.id and day = p_day;
  if found then return old; end if;                 -- bought already: never charged twice
  if (me.state->>'cash')::numeric < cost then raise exception 'not enough cash'; end if;
  select jsonb_object_agg(m.id, jsonb_build_object('recipe', d.data->'plan'->'recipe', 'cups', d.data->'plan'->'cups', 'sec', d.data->'plan'->'sec')) into res
    from lm_member_days d join lm_members m on m.id = d.member where m.hood = p_hood and d.day = p_day - 1 and m.id <> me.id;
  if res is null then raise exception 'not ready'; end if;
  update lm_members set state = jsonb_set(state, '{cash}', to_jsonb(round((state->>'cash')::numeric - cost, 2))) where id = me.id;
  insert into lm_spied(member, day, cost, data) values (me.id, p_day, cost, res);
  return res;
end $$;

-- every report I bought, by the day it tells about
create or replace function public.lm_rivals_intel(p_hood uuid) returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(s.day - 1, s.data), '{}'::json) from lm_spied s join lm_members m on m.id = s.member where m.hood = p_hood and m.user_id = auth.uid() $$;

revoke all on function public.lm_buy_rivals(uuid, int) from public, anon;
revoke all on function public.lm_rivals_intel(uuid) from public, anon;
grant execute on function public.lm_buy_rivals(uuid, int) to authenticated;
grant execute on function public.lm_rivals_intel(uuid) to authenticated;
