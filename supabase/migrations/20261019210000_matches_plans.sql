-- 0003 Matches, lineups and match plans. Requirements: MATCH-01, MATCH-02, PLAN-01, SEC-01.

-- ---------------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  opponent_name varchar(60) not null check (char_length(btrim(opponent_name)) between 1 and 60),
  kickoff_at timestamptz not null,
  -- IANA zone the kickoff was entered in, so local time is shown consistently (DEC-09).
  kickoff_tz text not null check (char_length(kickoff_tz) between 1 and 64),
  venue varchar(120) check (venue is null or char_length(btrim(venue)) between 1 and 120),
  -- Copied from the team at creation: later team format changes don't alter this match (PRD §6).
  match_format smallint not null check (match_format in (5, 7, 11)),
  status text not null default 'scheduled' check (status in ('scheduled', 'played', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index matches_team_id_kickoff_at_idx on public.matches (team_id, kickoff_at);

create trigger matches_set_updated_at before update on public.matches
  for each row execute function public.set_updated_at();
create trigger matches_prevent_team_change before update on public.matches
  for each row execute function public.prevent_team_change();

-- ---------------------------------------------------------------------------
-- match_plans: exactly one per match
-- ---------------------------------------------------------------------------
create table public.match_plans (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches (id) on delete cascade,
  objective varchar(280),
  draft_status text not null default 'draft' check (draft_status in ('draft', 'published')),
  version int not null default 1,
  updated_at timestamptz not null default now()
);

create or replace function public.bump_plan_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version = old.version + 1;
  new.updated_at = now();
  return new;
end;
$$;

create trigger match_plans_bump_version before update on public.match_plans
  for each row execute function public.bump_plan_version();

create or replace function public.prevent_match_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.match_id is distinct from old.match_id then
    raise exception 'plans cannot move between matches' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger match_plans_prevent_match_change before update on public.match_plans
  for each row execute function public.prevent_match_change();

-- ---------------------------------------------------------------------------
-- Ownership helpers (SECURITY DEFINER so child policies don't recurse; caller-scoped).
-- ---------------------------------------------------------------------------
create or replace function public.is_match_owner(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m join public.teams t on t.id = m.team_id
    where m.id = p_match_id and t.owner_id = (select auth.uid())
  );
$$;

create or replace function public.is_plan_owner(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.match_plans p
    join public.matches m on m.id = p.match_id
    join public.teams t on t.id = m.team_id
    where p.id = p_plan_id and t.owner_id = (select auth.uid())
  );
$$;

-- Team and format of a plan, for integrity triggers.
create or replace function public.plan_context(p_plan_id uuid, out team_id uuid, out match_format smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.team_id, m.match_format from public.match_plans p join public.matches m on m.id = p.match_id where p.id = p_plan_id;
$$;

-- ---------------------------------------------------------------------------
-- lineup_assignments (MATCH-02)
-- ---------------------------------------------------------------------------
create table public.lineup_assignments (
  plan_id uuid not null references public.match_plans (id) on delete cascade,
  -- Restrict: players are archive-only, and lineups keep pointing at them (DEC-08).
  player_id uuid not null references public.players (id) on delete restrict,
  role text not null check (role in ('starter', 'bench')),
  formation_slot smallint check (formation_slot between 1 and 11),
  position_label varchar(12),
  primary key (plan_id, player_id),
  constraint lineup_slot_only_for_starters check (role = 'starter' or formation_slot is null)
);

create unique index lineup_assignments_slot_idx on public.lineup_assignments (plan_id, formation_slot) where formation_slot is not null;
create index lineup_assignments_player_idx on public.lineup_assignments (player_id);

create or replace function public.check_lineup_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctx record;
  starters int;
begin
  select * into ctx from public.plan_context(new.plan_id);
  if not exists (select 1 from public.players where id = new.player_id and team_id = ctx.team_id) then
    raise exception 'player is not in this team''s squad' using errcode = '23514';
  end if;
  if new.role = 'starter' then
    select count(*) into starters from public.lineup_assignments
      where plan_id = new.plan_id and role = 'starter' and player_id <> new.player_id;
    if starters >= ctx.match_format then
      raise exception 'a %v% lineup can have at most % starters', ctx.match_format, ctx.match_format, ctx.match_format using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger lineup_assignments_check before insert or update on public.lineup_assignments
  for each row execute function public.check_lineup_assignment();

-- ---------------------------------------------------------------------------
-- plan_sections (PLAN-01)
-- ---------------------------------------------------------------------------
create table public.plan_sections (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.match_plans (id) on delete cascade,
  section_type text not null check (section_type in ('board', 'notes', 'reminders')),
  title varchar(80) not null check (char_length(btrim(title)) between 1 and 80),
  -- { phase, notes, privateNotes } - privateNotes is never copied into a published snapshot (D-05).
  content_json jsonb not null default '{}'::jsonb check (jsonb_typeof(content_json) = 'object' and pg_column_size(content_json) <= 16384),
  tactic_id uuid references public.tactics (id) on delete set null,
  include_in_briefing boolean not null default true,
  sort_order int not null,
  constraint plan_sections_tactic_only_on_boards check (section_type = 'board' or tactic_id is null)
);

create index plan_sections_plan_id_sort_order_idx on public.plan_sections (plan_id, sort_order);
create index plan_sections_tactic_id_idx on public.plan_sections (tactic_id);

create or replace function public.check_plan_section()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctx record;
begin
  if tg_op = 'UPDATE' and new.plan_id is distinct from old.plan_id then
    raise exception 'sections cannot move between plans' using errcode = '42501';
  end if;
  if new.tactic_id is not null then
    select * into ctx from public.plan_context(new.plan_id);
    if not exists (select 1 from public.tactics where id = new.tactic_id and team_id = ctx.team_id) then
      raise exception 'tactic is not from this team' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger plan_sections_check before insert or update on public.plan_sections
  for each row execute function public.check_plan_section();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.matches enable row level security;
alter table public.match_plans enable row level security;
alter table public.lineup_assignments enable row level security;
alter table public.plan_sections enable row level security;

create policy "matches: owner all" on public.matches for all to authenticated
  using (public.is_team_owner(team_id)) with check (public.is_team_owner(team_id));
create policy "match_plans: owner all" on public.match_plans for all to authenticated
  using (public.is_match_owner(match_id)) with check (public.is_match_owner(match_id));
create policy "lineup: owner all" on public.lineup_assignments for all to authenticated
  using (public.is_plan_owner(plan_id)) with check (public.is_plan_owner(plan_id));
create policy "sections: owner all" on public.plan_sections for all to authenticated
  using (public.is_plan_owner(plan_id)) with check (public.is_plan_owner(plan_id));

revoke all on public.matches, public.match_plans, public.lineup_assignments, public.plan_sections from anon, authenticated;
grant select, insert, delete on public.matches to authenticated;
grant update (opponent_name, kickoff_at, kickoff_tz, venue, status) on public.matches to authenticated;
grant select, insert on public.match_plans to authenticated;
grant update (objective) on public.match_plans to authenticated;
grant select, insert, update, delete on public.lineup_assignments to authenticated;
grant select, insert, delete on public.plan_sections to authenticated;
grant update (title, content_json, tactic_id, include_in_briefing, sort_order) on public.plan_sections to authenticated;

revoke execute on function public.is_match_owner(uuid), public.is_plan_owner(uuid), public.plan_context(uuid) from public, anon;
grant execute on function public.is_match_owner(uuid), public.is_plan_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs (SECURITY INVOKER: RLS and triggers apply as the caller)
-- ---------------------------------------------------------------------------

-- Replace a plan's whole lineup atomically. p_lineup: [{playerId, role, slot?, position?}]
create or replace function public.save_lineup(p_plan_id uuid, p_lineup jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_plan_owner(p_plan_id) then
    raise exception 'not found' using errcode = '42501';
  end if;
  delete from public.lineup_assignments where plan_id = p_plan_id;
  insert into public.lineup_assignments (plan_id, player_id, role, formation_slot, position_label)
  select p_plan_id, (e ->> 'playerId')::uuid, e ->> 'role', (e ->> 'slot')::smallint, nullif(btrim(e ->> 'position'), '')
  from jsonb_array_elements(p_lineup) e;
end;
$$;

-- Move a section up (-1) or down (+1) by swapping with its neighbour.
create or replace function public.move_plan_section(p_section_id uuid, p_delta int)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me record;
  other record;
begin
  select id, plan_id, sort_order into me from public.plan_sections where id = p_section_id;
  if not found then
    raise exception 'not found' using errcode = '42501';
  end if;
  if p_delta < 0 then
    select id, sort_order into other from public.plan_sections
      where plan_id = me.plan_id and sort_order < me.sort_order order by sort_order desc limit 1;
  else
    select id, sort_order into other from public.plan_sections
      where plan_id = me.plan_id and sort_order > me.sort_order order by sort_order asc limit 1;
  end if;
  if not found then
    return;
  end if;
  update public.plan_sections set sort_order = other.sort_order where id = me.id;
  update public.plan_sections set sort_order = me.sort_order where id = other.id;
end;
$$;

revoke execute on function public.save_lineup(uuid, jsonb), public.move_plan_section(uuid, int) from public, anon;
grant execute on function public.save_lineup(uuid, jsonb), public.move_plan_section(uuid, int) to authenticated;
