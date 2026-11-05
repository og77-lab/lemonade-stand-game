-- League settings: which features a neighborhood plays with (chosen before it starts, fixed afterwards), and deleting a neighborhood.
-- Run once in the SQL editor, after supabase-neighborhood.sql.

alter table public.lm_hoods add column if not exists features jsonb not null default '{}'::jsonb;

-- The owner sets the features until the stands open on day 1. Missing keys mean on.
create or replace function public.lm_hood_set_features(p_hood uuid, p_features jsonb) returns void language plpgsql security definer set search_path = public as $$
declare h lm_hoods;
begin
  select * into h from lm_hoods where id = p_hood;
  if not found or h.owner is distinct from auth.uid() then raise exception 'not the owner'; end if;
  if lm_local() >= lm_open_at(h, 1) then raise exception 'already started'; end if;
  update lm_hoods set features = jsonb_build_object('fund', coalesce((p_features->>'fund')::boolean, true), 'coupons', coalesce((p_features->>'coupons')::boolean, true),
    'black', coalesce((p_features->>'black')::boolean, true)) where id = p_hood;
end $$;
create or replace function public.lm_hood_features(p_hood uuid) returns json language sql stable security definer set search_path = public as $$
  select h.features::json from lm_hoods h join lm_members m on m.hood = h.id and m.user_id = auth.uid() where h.id = p_hood $$;

-- Only the owner, and everything of the neighborhood goes with it
create or replace function public.lm_hood_delete(p_hood uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  delete from lm_hoods where id = p_hood and owner = auth.uid();
  if not found then raise exception 'not the owner'; end if;
end $$;

-- My neighborhoods, now saying which are mine to delete
create or replace function public.lm_my_hoods() returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', h.id, 'name', h.name, 'code', h.code, 'days', h.days, 'start', h.start_date,
    'last_day', h.last_day, 'status', h.status, 'size', h.size, 'owner', h.owner = auth.uid()) order by h.created_at desc), '[]'::json)
  from lm_hoods h join lm_members m on m.hood = h.id and m.user_id = auth.uid() $$;

revoke all on function public.lm_hood_set_features(uuid, jsonb) from public, anon;
revoke all on function public.lm_hood_features(uuid) from public, anon;
revoke all on function public.lm_hood_delete(uuid) from public, anon;
grant execute on function public.lm_hood_set_features(uuid, jsonb) to authenticated;
grant execute on function public.lm_hood_features(uuid) to authenticated;
grant execute on function public.lm_hood_delete(uuid) to authenticated;
