-- A stand's coupon record is intel: for ₪4 in the evening, what that stand did and said on its past nights.
-- Run once in the SQL editor, after supabase-neighborhood.sql.

create table if not exists public.lm_records (      -- records bought: the evening it was bought shows every night before it
  member uuid not null references public.lm_members(id) on delete cascade,
  target uuid not null references public.lm_members(id) on delete cascade,
  day int not null,
  cost numeric not null,
  primary key (member, target, day)
);
alter table public.lm_records enable row level security;

create or replace function public.lm_buy_record(p_hood uuid, p_day int, p_target uuid) returns json language plpgsql security definer set search_path = public as $$
declare h lm_hoods; me lm_members; cost numeric := 4;
begin
  select * into me from lm_members where hood = p_hood and user_id = auth.uid() for update;
  if not found then raise exception 'not a member'; end if;
  select * into h from lm_hoods where id = p_hood;
  if lm_deciding(h) is distinct from p_day or p_day < 2 then raise exception 'locked'; end if;
  if p_target = me.id or not exists (select 1 from lm_members where id = p_target and hood = p_hood) then raise exception 'bad target'; end if;
  if exists (select 1 from lm_records where member = me.id and target = p_target and day = p_day) then return json_build_object('ok', true); end if; -- never charged twice
  if (me.state->>'cash')::numeric < cost then raise exception 'not enough cash'; end if;
  update lm_members set state = jsonb_set(state, '{cash}', to_jsonb(round((state->>'cash')::numeric - cost, 2))) where id = me.id;
  insert into lm_records(member, target, day, cost) values (me.id, p_target, p_day, cost);
  return json_build_object('ok', true);
end $$;

-- every stand whose record I bought, and the last evening I did
create or replace function public.lm_my_records(p_hood uuid) returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(x.target, x.day), '{}'::json) from (
    select r.target, max(r.day) as day from lm_records r join lm_members me on me.id = r.member
    where me.hood = p_hood and me.user_id = auth.uid() group by r.target) x $$;

revoke all on function public.lm_buy_record(uuid, int, uuid) from public, anon;
revoke all on function public.lm_my_records(uuid) from public, anon;
grant execute on function public.lm_buy_record(uuid, int, uuid) to authenticated;
grant execute on function public.lm_my_records(uuid) to authenticated;
