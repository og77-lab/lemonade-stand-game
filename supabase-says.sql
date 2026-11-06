-- What the stands say tonight about tomorrow's coupons: a player's word is in its saved decision, a bot's in the evening's intel. Only the word is read, never the decision.
-- Run once in the SQL editor, after supabase-neighborhood.sql.

create or replace function public.lm_hood_says(p_hood uuid) returns json language plpgsql stable security definer set search_path = public as $$
declare h lm_hoods; d int; r json;
begin
  if not exists (select 1 from lm_members where hood = p_hood and user_id = auth.uid()) then raise exception 'not a member'; end if;
  select * into h from lm_hoods where id = p_hood;
  d := lm_deciding(h);
  if d is null then return '{}'::json; end if;
  select coalesce(json_object_agg(x.id, x.say), '{}'::json) into r from (
    select m.id, (i.data->'says'->>(m.id::text))::boolean as say from lm_members m join lm_intel i on i.hood = p_hood and i.day = d
      where m.hood = p_hood and m.user_id is null and i.data->'says' ? m.id::text
    union all
    select m.id, (c.dec->>'say')::boolean from lm_members m join lm_decisions c on c.member = m.id and c.day = d
      where m.hood = p_hood and m.user_id is not null and jsonb_typeof(c.dec->'say') = 'boolean') x;
  return r;
end $$;

revoke all on function public.lm_hood_says(uuid) from public, anon;
grant execute on function public.lm_hood_says(uuid) to authenticated;
