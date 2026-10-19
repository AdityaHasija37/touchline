-- 0001 Foundation: profiles, teams, players.
-- Requirements: AUTH-01, TEAM-01, TEAM-02, SEC-01. Security model: docs/IMPLEMENTATION-MAP.md §4.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name varchar(60),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 60));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name varchar(60) not null check (char_length(btrim(name)) between 2 and 60),
  match_format smallint not null check (match_format in (5, 7, 11)),
  primary_color char(7) not null default '#2f7d4f' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teams_owner_id_idx on public.teams (owner_id);

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

-- Ownership never transfers in MVP (ADR-04).
create or replace function public.prevent_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'team ownership cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger teams_prevent_owner_change
  before update on public.teams
  for each row execute function public.prevent_owner_change();

-- ---------------------------------------------------------------------------
-- Ownership helper used by every child-table policy.
-- SECURITY DEFINER so policies on child tables don't recurse through teams RLS;
-- it only ever answers for the calling user.
-- ---------------------------------------------------------------------------
create or replace function public.is_team_owner(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teams t
    where t.id = p_team_id and t.owner_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------
create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name varchar(60) not null check (char_length(btrim(name)) between 1 and 60),
  shirt_number smallint check (shirt_number between 0 and 99),
  preferred_positions text[] not null default '{}'
    check (preferred_positions <@ array['GK', 'DEF', 'MID', 'FWD']::text[]),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index players_team_id_archived_at_idx on public.players (team_id, archived_at);

create trigger players_set_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

-- Player IDs are stable and belong to one team for life (TEAM-02).
create or replace function public.prevent_team_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.team_id is distinct from old.team_id then
    raise exception 'records cannot move between teams' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger players_prevent_team_change
  before update on public.players
  for each row execute function public.prevent_team_change();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "teams: owner read" on public.teams
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "teams: owner insert" on public.teams
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "teams: owner update" on public.teams
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "teams: owner delete" on public.teams
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "players: owner read" on public.players
  for select to authenticated using (public.is_team_owner(team_id));
create policy "players: owner insert" on public.players
  for insert to authenticated with check (public.is_team_owner(team_id));
create policy "players: owner update" on public.players
  for update to authenticated using (public.is_team_owner(team_id)) with check (public.is_team_owner(team_id));
-- No delete policy: players are archive-only (DEC-08). Team deletion cascades.

-- ---------------------------------------------------------------------------
-- Grants: match privileges to actual use. Supabase's default privileges grant
-- everything to anon/authenticated, so start from zero.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.teams, public.players from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update on public.players to authenticated;

revoke execute on function public.is_team_owner(uuid) from public, anon;
grant execute on function public.is_team_owner(uuid) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
