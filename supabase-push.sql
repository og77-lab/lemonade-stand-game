-- Reminders: a player who turned them on in the settings gets a push notification in the evening and early in the morning, if they haven't decided yet.
-- Run once in the SQL editor, after supabase-neighborhood.sql. The Edge Function sends them; it needs the secret VAPID_KEY.

create table if not exists public.lm_push (         -- one row per device that turned reminders on
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  evening boolean not null default false,
  morning boolean not null default false,
  saved_at timestamptz not null default now()
);
create index if not exists lm_push_user on public.lm_push(user_id);
create table if not exists public.lm_reminders (    -- a neighborhood's reminder is sent once, however many times the server runs
  hood uuid not null references public.lm_hoods(id) on delete cascade,
  day int not null,
  slot text not null check (slot in ('evening', 'morning')),
  sent_at timestamptz not null default now(),
  primary key (hood, day, slot)
);
alter table public.lm_push enable row level security;
alter table public.lm_reminders enable row level security;

-- Only the browsers' own push services: the server will post to whatever address is saved here
create or replace function public.lm_push_save(p_endpoint text, p_p256dh text, p_auth text, p_evening boolean, p_morning boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if length(p_endpoint) > 1000 or p_endpoint !~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com)/' then raise exception 'bad endpoint'; end if;
  if length(p_p256dh) > 200 or length(p_auth) > 100 then raise exception 'bad keys'; end if;
  if (select count(*) from lm_push where user_id = auth.uid() and endpoint <> p_endpoint) >= 5 then raise exception 'too many devices'; end if;
  insert into lm_push(endpoint, user_id, p256dh, auth, evening, morning) values (p_endpoint, auth.uid(), p_p256dh, p_auth, p_evening, p_morning)
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, evening = excluded.evening, morning = excluded.morning, saved_at = now();
end $$;
create or replace function public.lm_push_delete(p_endpoint text) returns void language sql security definer set search_path = public as $$
  delete from lm_push where endpoint = p_endpoint and user_id = auth.uid() $$;

revoke all on function public.lm_push_save(text, text, text, boolean, boolean) from public, anon;
revoke all on function public.lm_push_delete(text) from public, anon;
grant execute on function public.lm_push_save(text, text, text, boolean, boolean) to authenticated;
grant execute on function public.lm_push_delete(text) to authenticated;
