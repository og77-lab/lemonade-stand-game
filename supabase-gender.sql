-- How the game speaks about each player: the player's own choice, kept per stand so other players' screens say it right, and the matching figure.
-- Run once in the SQL editor, after supabase-neighborhood.sql.

alter table public.lm_members add column if not exists gender text check (gender in ('m', 'f'));

create or replace function public.lm_hood_set_gender(p_hood uuid, p_gender text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_gender not in ('m', 'f') then raise exception 'bad gender'; end if;
  update lm_members set gender = p_gender, em = case p_gender when 'f' then '👧' else '👦' end where hood = p_hood and user_id = auth.uid();
end $$;
create or replace function public.lm_hood_genders(p_hood uuid) returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(m.id, m.gender) filter (where m.gender is not null), '{}'::json) from lm_members m
  where m.hood = p_hood and exists (select 1 from lm_members me where me.hood = p_hood and me.user_id = auth.uid()) $$;

revoke all on function public.lm_hood_set_gender(uuid, text) from public, anon;
revoke all on function public.lm_hood_genders(uuid) from public, anon;
grant execute on function public.lm_hood_set_gender(uuid, text) to authenticated;
grant execute on function public.lm_hood_genders(uuid) to authenticated;
