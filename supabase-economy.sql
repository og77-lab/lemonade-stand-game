-- A stand starts with ₪200 instead of ₪80, so the first day can cover a real crowd and still leave room for marketing and security.
-- Stands in leagues still running get the difference once. The score counts profit only, so the table does not move.
-- Run once in the SQL editor, after supabase-neighborhood.sql.

create or replace function public.lm_new_stand() returns jsonb language sql immutable as $$
  select '{"cash":200,"lemons":[{"q":40,"d":1}],"sugar":0,"ice":0,"rep":50,"ups":[],"loan":0,"tot":0,"tricks":0,"paper":false,"topped":true}'::jsonb $$;

update public.lm_members m
  set state = jsonb_set(jsonb_set(m.state, '{cash}', to_jsonb(round((m.state->>'cash')::numeric + 120, 2))), '{topped}', 'true'::jsonb)
  from public.lm_hoods h
  where h.id = m.hood and h.status <> 'done' and not m.state ? 'topped';
