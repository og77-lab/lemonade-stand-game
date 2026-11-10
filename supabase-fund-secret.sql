-- The street fund is a secret: remove what the past days kept about how much the street gave.
-- Run once in the SQL editor. It removes the total from each day's public data and moments,
-- from each stand's private record, and from the record the bots learn from.

update public.lm_days
set open = open #- '{fund,gifts}' #- '{fund,luck}'
where open->'fund' ? 'gifts' or open->'fund' ? 'luck';

update public.lm_days
set events = (select coalesce(jsonb_agg(case when e->>'type' = 'fund' then e - 'gifts' else e end order by i), '[]'::jsonb)
              from jsonb_array_elements(events) with ordinality as t(e, i))
where events::text like '%"gifts"%';

update public.lm_member_days
set data = data #- '{res,fund,all}'
where data->'res'->'fund' ? 'all';

update public.lm_members
set state = jsonb_set(state, '{fd}', (select coalesce(jsonb_agg(f - 'a' order by i), '[]'::jsonb)
                                      from jsonb_array_elements(state->'fd') with ordinality as t(f, i)))
where jsonb_typeof(state->'fd') = 'array' and (state->'fd')::text like '%"a"%';
