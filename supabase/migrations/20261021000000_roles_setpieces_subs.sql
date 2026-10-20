-- 0009 Player roles & duties, formation, set pieces and sub plan (enhancements 1, 2, 4, 5).

-- Per-starter role (FM-style), duty and a one-line personal instruction.
alter table public.lineup_assignments
  add column player_role varchar(40) check (player_role is null or player_role ~ '^[a-z_]{2,40}$'),
  add column duty text check (duty is null or duty in ('defend', 'support', 'attack')),
  add column instruction varchar(140) check (instruction is null or char_length(btrim(instruction)) between 1 and 140),
  add constraint lineup_role_fields_only_for_starters check (role = 'starter' or (player_role is null and duty is null and instruction is null));

-- Plan-level: formation for the pitch builder, set-piece takers, and a substitution plan.
alter table public.match_plans
  add column formation_id varchar(20) check (formation_id is null or formation_id ~ '^[0-9]{1,2}-[0-9]{1,6}$'),
  add column set_pieces jsonb not null default '{}'::jsonb
    check (jsonb_typeof(set_pieces) = 'object' and pg_column_size(set_pieces) <= 4096),
  add column sub_plan jsonb not null default '{}'::jsonb
    check (jsonb_typeof(sub_plan) = 'object' and pg_column_size(sub_plan) <= 8192);

grant update (objective, formation_id, set_pieces, sub_plan) on public.match_plans to authenticated;

-- save_lineup now also stores role, duty and instruction for starters, and honours explicit slots.
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
  insert into public.lineup_assignments (plan_id, player_id, role, formation_slot, position_label, player_role, duty, instruction)
  select p_plan_id,
         (e ->> 'playerId')::uuid,
         e ->> 'role',
         (e ->> 'slot')::smallint,
         nullif(btrim(e ->> 'position'), ''),
         nullif(btrim(e ->> 'playerRole'), ''),
         nullif(btrim(e ->> 'duty'), ''),
         nullif(btrim(e ->> 'instruction'), '')
  from jsonb_array_elements(p_lineup) e;
end;
$$;

-- Adoption of the 1.1 features, as counts only (PLAN-004 §5): plan_published may also carry
-- has_formation (0/1), roles_count, set_piece_jobs and subs_count.
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
         when 'plan_published' then array['slide_count', 'format', 'has_formation', 'roles_count', 'set_piece_jobs', 'subs_count']
         when 'presentation_opened' then array['viewer_type', 'slide_count']
         when 'pdf_exported' then array['slide_count', 'latency_ms', 'viewer_type']
         when 'share_revoked' then array['link_age_days']
         else array[]::text[] end)
       and (jsonb_typeof(v) = 'number' or (jsonb_typeof(v) = 'string' and v #>> '{}' in ('owner', 'public'))))
     from jsonb_each(p_props) as e(k, v)),
    true);
$$;
revoke execute on function public.analytics_props_ok(text, jsonb) from public, anon;
