-- 0002 Tactics boards. Requirements: TAC-01, TAC-02, TAC-03, SEC-01. Contract: lib/validation/board.ts.

create table public.tactics (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name varchar(60) not null check (char_length(btrim(name)) between 1 and 60),
  category text not null default 'shape'
    check (category in ('shape', 'attacking', 'defending', 'set_piece', 'other')),
  format smallint not null check (format in (5, 7, 11)),
  board_schema_version int not null default 1 check (board_schema_version = 1),
  board_json jsonb not null,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Shape guard only; the full contract is validated by Zod at the API boundary.
  constraint tactics_board_shape check (
    jsonb_typeof(board_json) = 'object'
    and (board_json ->> 'schemaVersion')::int = board_schema_version
    and (board_json ->> 'format')::int = format
    and jsonb_typeof(board_json -> 'objects') = 'array'
    and jsonb_array_length(board_json -> 'objects') <= 200
  ),
  constraint tactics_board_size check (pg_column_size(board_json) <= 262144)
);

create index tactics_team_id_updated_at_idx on public.tactics (team_id, updated_at desc);

-- Optimistic concurrency (TECH-003 §4, QA-04): the server owns `version`. It increments only
-- when the board changes, so renames don't invalidate an open editor. Clients can't set it.
create or replace function public.tactics_versioning()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.version = 1;
  else
    new.version = case when new.board_json is distinct from old.board_json then old.version + 1 else old.version end;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger tactics_versioning
  before insert or update on public.tactics
  for each row execute function public.tactics_versioning();

create trigger tactics_prevent_team_change
  before update on public.tactics
  for each row execute function public.prevent_team_change();

alter table public.tactics enable row level security;

create policy "tactics: owner read" on public.tactics
  for select to authenticated using (public.is_team_owner(team_id));
create policy "tactics: owner insert" on public.tactics
  for insert to authenticated with check (public.is_team_owner(team_id));
create policy "tactics: owner update" on public.tactics
  for update to authenticated using (public.is_team_owner(team_id)) with check (public.is_team_owner(team_id));
create policy "tactics: owner delete" on public.tactics
  for delete to authenticated using (public.is_team_owner(team_id));

revoke all on public.tactics from anon, authenticated;
grant select, insert, delete on public.tactics to authenticated;
grant update (name, category, board_json) on public.tactics to authenticated;
