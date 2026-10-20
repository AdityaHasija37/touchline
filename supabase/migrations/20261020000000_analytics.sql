-- 0006 Product analytics (PLAN-004 §5, Q-05 → DEC-44). Pseudonymous, allowlisted, write-only.
-- Never stores player names, coaching notes, emails, share tokens or board JSON.

-- A random per-team analytics id. Not readable by users (column grants), so once a team is
-- deleted its events can't be linked back to anyone: that's the deletion path.
alter table public.teams add column analytics_id uuid not null default gen_random_uuid();
revoke select on public.teams from authenticated;
grant select (id, owner_id, name, match_format, primary_color, created_at, updated_at) on public.teams to authenticated;

create table public.analytics_events (
  id bigint generated always as identity primary key,
  event text not null check (event in (
    'team_created', 'player_added', 'tactic_saved', 'match_plan_created',
    'plan_published', 'presentation_opened', 'pdf_exported', 'share_revoked'
  )),
  team_ref uuid not null,
  props jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 512),
  created_at timestamptz not null default now()
);
create index analytics_events_event_created_at_idx on public.analytics_events (event, created_at);

alter table public.analytics_events enable row level security;
-- No policies and no grants: written only through track_event / the public lookup, read only by operators.
revoke all on public.analytics_events from anon, authenticated;

-- Allowed properties per event; every value must be a number or one of the listed words.
create or replace function public.analytics_props_ok(p_event text, p_props jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select bool_and(
       k = any (case p_event
         when 'team_created' then array['format']
         when 'player_added' then array[]::text[]
         when 'tactic_saved' then array['format', 'object_count']
         when 'match_plan_created' then array['format', 'sections_count']
         when 'plan_published' then array['slide_count', 'format']
         when 'presentation_opened' then array['viewer_type', 'slide_count']
         when 'pdf_exported' then array['slide_count', 'latency_ms', 'viewer_type']
         when 'share_revoked' then array['link_age_days']
         else array[]::text[] end)
       and (jsonb_typeof(v) = 'number' or (jsonb_typeof(v) = 'string' and v #>> '{}' in ('owner', 'public'))))
     from jsonb_each(p_props) as e(k, v)),
    true);
$$;

-- Owner-side tracking. Best effort: invalid input is ignored, never raised, so analytics can't break a user action.
create or replace function public.track_event(p_event text, p_team_id uuid, p_props jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref uuid;
begin
  select analytics_id into ref from public.teams where id = p_team_id and owner_id = (select auth.uid());
  if ref is null or not public.analytics_props_ok(p_event, coalesce(p_props, '{}'::jsonb)) then
    return;
  end if;
  insert into public.analytics_events (event, team_ref, props) values (p_event, ref, coalesce(p_props, '{}'::jsonb));
exception when others then
  return;
end;
$$;

revoke execute on function public.track_event(text, uuid, jsonb), public.analytics_props_ok(text, jsonb) from public, anon;
grant execute on function public.track_event(text, uuid, jsonb) to authenticated;

-- Public lookups record presentation_opened / pdf_exported themselves (no extra service-role use).
drop function public.get_published_snapshot(text, text);
create or replace function public.get_published_snapshot(p_token text, p_client_hash text, p_purpose text default 'view')
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  win timestamptz := date_trunc('minute', now());
  n int;
  pub record;
begin
  if p_client_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  insert into public.share_lookup_counters as c (client_hash, window_start, hits)
  values (p_client_hash, win, 1)
  on conflict (client_hash, window_start) do update set hits = c.hits + 1
  returning hits into n;
  delete from public.share_lookup_counters where client_hash = p_client_hash and window_start < win - interval '10 minutes';

  if n > 60 then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select pp.snapshot_json, pp.slide_count, t.analytics_id into pub
  from public.published_plans pp
  join public.match_plans mp on mp.id = pp.plan_id
  join public.matches m on m.id = mp.match_id
  join public.teams t on t.id = m.team_id
  where pp.share_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') and pp.revoked_at is null;

  if pub.snapshot_json is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  begin
    insert into public.analytics_events (event, team_ref, props)
    values (case when p_purpose = 'pdf' then 'pdf_exported' else 'presentation_opened' end, pub.analytics_id,
            jsonb_build_object('viewer_type', 'public', 'slide_count', pub.slide_count));
  exception when others then
    null; -- analytics never blocks a player
  end;
  return jsonb_build_object('status', 'ok', 'snapshot', pub.snapshot_json);
end;
$$;

revoke execute on function public.get_published_snapshot(text, text, text) from public, anon, authenticated;
grant execute on function public.get_published_snapshot(text, text, text) to service_role;
