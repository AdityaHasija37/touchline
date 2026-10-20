-- 0005 Publication: immutable snapshots, hashed share tokens, revocation, audit, rate limiting.
-- Requirements: PRES-01, PRES-02, PLAN-01 (snapshot), SEC-01. Decisions: DEC-07, DEC-10, DEC-38..41.

-- ---------------------------------------------------------------------------
-- published_plans
-- ---------------------------------------------------------------------------
create table public.published_plans (
  id uuid primary key default gen_random_uuid(),
  -- Cascade: deleting the plan/fixture/team revokes its links (DEC-07).
  plan_id uuid not null references public.match_plans (id) on delete cascade,
  -- sha256(raw token) as hex. The raw token is shown to the owner once and never stored.
  share_token_hash char(64) not null unique check (share_token_hash ~ '^[0-9a-f]{64}$'),
  -- Allowlisted, self-contained briefing (lib/domain/snapshot.ts). No private notes, no squad directory, no player ids.
  snapshot_json jsonb not null check (jsonb_typeof(snapshot_json) = 'object' and (snapshot_json ->> 'version')::int = 1),
  slide_count int not null check (slide_count between 1 and 60),
  published_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  published_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint published_plans_size check (pg_column_size(snapshot_json) <= 1048576)
);

-- At most one live link per plan.
create unique index published_plans_one_active_idx on public.published_plans (plan_id) where revoked_at is null;
create index published_plans_plan_id_idx on public.published_plans (plan_id);

-- Revocation is one-way: a revoked row can never be un-revoked or have its token changed.
create or replace function public.guard_publication_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.revoked_at is not null then
    raise exception 'revoked links cannot be changed' using errcode = '42501';
  end if;
  if new.share_token_hash is distinct from old.share_token_hash or new.plan_id is distinct from old.plan_id then
    raise exception 'token and plan are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger published_plans_guard before update on public.published_plans
  for each row execute function public.guard_publication_update();

alter table public.published_plans enable row level security;
create policy "published: owner read" on public.published_plans for select to authenticated using (public.is_plan_owner(plan_id));
create policy "published: owner insert" on public.published_plans for insert to authenticated
  with check (public.is_plan_owner(plan_id) and published_by = (select auth.uid()));
create policy "published: owner update" on public.published_plans for update to authenticated
  using (public.is_plan_owner(plan_id)) with check (public.is_plan_owner(plan_id));

revoke all on public.published_plans from anon, authenticated;
-- The hash is never read back by the app; owners see metadata only.
grant select (id, plan_id, snapshot_json, slide_count, published_at, revoked_at) on public.published_plans to authenticated;
grant insert (plan_id, share_token_hash, snapshot_json, slide_count) on public.published_plans to authenticated;
grant update (snapshot_json, slide_count, published_at, revoked_at) on public.published_plans to authenticated;

-- ---------------------------------------------------------------------------
-- audit_events (insert-only from the owner's session)
-- ---------------------------------------------------------------------------
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  action text not null check (action in ('plan_published', 'plan_republished', 'share_revoked', 'share_rotated')),
  resource_type text not null check (resource_type in ('published_plan')),
  resource_id uuid not null,
  created_at timestamptz not null default now()
);

create index audit_events_team_id_created_at_idx on public.audit_events (team_id, created_at desc);

alter table public.audit_events enable row level security;
create policy "audit: owner insert" on public.audit_events for insert to authenticated
  with check (actor_id = (select auth.uid()) and public.is_team_owner(team_id));
create policy "audit: owner read" on public.audit_events for select to authenticated using (public.is_team_owner(team_id));

revoke all on public.audit_events from anon, authenticated;
grant select, insert on public.audit_events to authenticated;

-- ---------------------------------------------------------------------------
-- Public lookup with rate limiting (Q-04 → DEC-40)
-- ---------------------------------------------------------------------------
create table public.share_lookup_counters (
  client_hash char(64) not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (client_hash, window_start)
);
alter table public.share_lookup_counters enable row level security;
-- No policies and no grants: only the SECURITY DEFINER function below touches it.
revoke all on public.share_lookup_counters from anon, authenticated;

-- Only the app server may call this (service_role, from one server-only route). If anon could call
-- it directly via the REST API, a caller could pass any client hash and dodge the limit (DEC-40).
create or replace function public.get_published_snapshot(p_token text, p_client_hash text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  win timestamptz := date_trunc('minute', now());
  n int;
  snap jsonb;
begin
  if p_client_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Count every lookup, valid or not, per hashed client per minute.
  insert into public.share_lookup_counters as c (client_hash, window_start, hits)
  values (p_client_hash, win, 1)
  on conflict (client_hash, window_start) do update set hits = c.hits + 1
  returning hits into n;
  -- Opportunistic cleanup of this client's old windows.
  delete from public.share_lookup_counters where client_hash = p_client_hash and window_start < win - interval '10 minutes';

  if n > 60 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  -- Tokens are 43-char base64url; anything else can't match, so don't bother hashing junk.
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select snapshot_json into snap
  from public.published_plans
  where share_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') and revoked_at is null;

  -- Revoked and unknown tokens are indistinguishable to the caller.
  if snap is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  return jsonb_build_object('status', 'ok', 'snapshot', snap);
end;
$$;

revoke execute on function public.get_published_snapshot(text, text) from public, anon, authenticated;
grant execute on function public.get_published_snapshot(text, text) to service_role;
