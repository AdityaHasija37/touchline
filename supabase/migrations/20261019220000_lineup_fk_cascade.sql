-- Fix: lineup_assignments.player_id was ON DELETE RESTRICT, which made deleting a team (or an
-- account) with any lineup fail: the RI check on players fires before the longer
-- team → match → plan → lineup cascade has removed the lineup rows. NO ACTION has the same
-- ordering problem, so cascade instead. This is safe because players can't be deleted by users
-- at all (no DELETE grant; archive-only, DEC-08), so a player row only disappears together with
-- its whole team or account. Published briefings are immutable snapshots and don't reference it.
alter table public.lineup_assignments drop constraint lineup_assignments_player_id_fkey;
alter table public.lineup_assignments
  add constraint lineup_assignments_player_id_fkey foreign key (player_id) references public.players (id) on delete cascade;
