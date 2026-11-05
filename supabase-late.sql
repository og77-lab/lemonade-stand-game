-- Joining in the middle of a season: the player takes a free place or a bot's place, and starts from nothing (₪80, no profit from the days that passed).
-- The bot's past days leave the tables, so nobody inherits them. Run once in the SQL editor, after supabase-neighborhood.sql.

create or replace function public.lm_hood_join_late(p_code text, p_nick text) returns json language plpgsql security definer set search_path = public as $$
declare h lm_hoods; b lm_members; n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_nick is null or char_length(btrim(p_nick)) not between 2 and 16 then raise exception 'bad nickname'; end if;
  select * into h from lm_hoods where code = upper(btrim(p_code)) for update;
  if not found then raise exception 'no such neighborhood'; end if;
  if exists (select 1 from lm_members where hood = h.id and user_id = auth.uid()) then return json_build_object('id', h.id); end if;
  if h.status = 'done' or h.last_day >= h.days then raise exception 'season over'; end if;
  -- a league with room takes the player in a new place; a full one gives up a bot's place
  select count(*) into n from lm_members where hood = h.id;
  if n < h.size then
    insert into lm_members(hood, user_id, slot, nick, state) values (h.id, auth.uid(), (select max(slot) + 1 from lm_members where hood = h.id), btrim(p_nick), lm_new_stand());
    return json_build_object('id', h.id);
  end if;
  select * into b from lm_members where hood = h.id and user_id is null order by slot desc limit 1;
  if not found then raise exception 'neighborhood full'; end if;
  update lm_members set user_id = auth.uid(), nick = btrim(p_nick), em = '🍋', persona = null, joined_at = now(), state = lm_new_stand() where id = b.id;
  delete from lm_member_days where member = b.id;
  update lm_days d set results = (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(d.results) e where e->>'id' <> b.id::text) where d.hood = h.id;
  return json_build_object('id', h.id);
end $$;

-- The owner removes a player: the stand stays on the street as a bot, with what it has, and the player can come back only by joining again from nothing
create or replace function public.lm_hood_kick(p_hood uuid, p_member uuid) returns void language plpgsql security definer set search_path = public as $$
declare h lm_hoods; m lm_members; personas text[] := array['budget','premium','steady','trendy','gambler','veteran'];
begin
  select * into h from lm_hoods where id = p_hood;
  if not found or h.owner is distinct from auth.uid() then raise exception 'not the owner'; end if;
  select * into m from lm_members where id = p_member and hood = p_hood;
  if not found or m.user_id is null then raise exception 'no such player'; end if;
  if m.user_id = auth.uid() then raise exception 'not yourself'; end if;
  update lm_members set user_id = null, persona = personas[1 + m.slot % 6] where id = p_member;
end $$;

revoke all on function public.lm_hood_join_late(text, text) from public, anon;
revoke all on function public.lm_hood_kick(uuid, uuid) from public, anon;
grant execute on function public.lm_hood_kick(uuid, uuid) to authenticated;
grant execute on function public.lm_hood_join_late(text, text) to authenticated;
