-- MATCH-01 / MATCH-02 / PLAN-01 / SEC-01 at the database layer.
begin;
select plan(28);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.test');
insert into public.teams (id, owner_id, name, match_format) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A Five', 5),
  ('22222222-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'B Five', 5);
insert into public.players (id, team_id, name)
select ('a0000000-0000-0000-0000-00000000000' || g)::uuid, '11111111-0000-0000-0000-000000000001', 'A player ' || g from generate_series(1, 7) g;
insert into public.players (id, team_id, name) values ('b0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'B player');
insert into public.tactics (id, team_id, name, format, board_json) values
  ('a1000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'A shape', 5, '{"schemaVersion":1,"format":5,"orientation":"vertical","objects":[]}'),
  ('b1000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'B shape', 5, '{"schemaVersion":1,"format":5,"orientation":"vertical","objects":[]}');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select ok((select bool_and(relrowsecurity) from pg_class where oid in
  ('public.matches'::regclass, 'public.match_plans'::regclass, 'public.lineup_assignments'::regclass, 'public.plan_sections'::regclass)), 'RLS on all plan tables');

-- Owner A ----------------------------------------------------------------
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.matches (id, team_id, opponent_name, kickoff_at, kickoff_tz, match_format)
  values ('c0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Dynamos', '2026-10-25 14:00+01', 'Europe/London', 5) $$, 'owner creates a fixture with no venue');
select lives_ok($$ insert into public.match_plans (id, match_id) values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001') $$, 'owner creates its plan');
select throws_ok($$ insert into public.match_plans (match_id) values ('c0000000-0000-0000-0000-000000000001') $$, '23505', null, 'one plan per match');
select throws_ok($$ insert into public.matches (team_id, opponent_name, kickoff_at, kickoff_tz, match_format)
  values ('11111111-0000-0000-0000-000000000001', '', now(), 'UTC', 5) $$, '23514', null, 'opponent required');

-- Lineup
select lives_ok($$ select public.save_lineup('d0000000-0000-0000-0000-000000000001',
  '[{"playerId":"a0000000-0000-0000-0000-000000000001","role":"starter","slot":1,"position":"GK"},
    {"playerId":"a0000000-0000-0000-0000-000000000002","role":"starter","slot":2},
    {"playerId":"a0000000-0000-0000-0000-000000000003","role":"bench"}]') $$, 'save a draft (incomplete) lineup');
select is((select count(*)::int from public.lineup_assignments), 3, 'lineup rows stored');
select throws_ok($$ select public.save_lineup('d0000000-0000-0000-0000-000000000001',
  (select jsonb_agg(jsonb_build_object('playerId', id, 'role', 'starter', 'slot', n)) from (select id, row_number() over (order by id) as n from public.players where team_id = '11111111-0000-0000-0000-000000000001') s)) $$,
  '23514', null, 'more starters than the format is rejected');
select is((select count(*)::int from public.lineup_assignments), 3, 'failed save leaves the previous lineup intact');
select throws_ok($$ select public.save_lineup('d0000000-0000-0000-0000-000000000001',
  '[{"playerId":"a0000000-0000-0000-0000-000000000001","role":"starter"},{"playerId":"a0000000-0000-0000-0000-000000000001","role":"bench"}]') $$,
  '23505', null, 'the same player cannot appear twice');
select throws_ok($$ select public.save_lineup('d0000000-0000-0000-0000-000000000001',
  '[{"playerId":"b0000000-0000-0000-0000-000000000001","role":"starter"}]') $$, '23514', null, 'players from another team rejected');
select throws_ok($$ select public.save_lineup('d0000000-0000-0000-0000-000000000001',
  '[{"playerId":"a0000000-0000-0000-0000-000000000004","role":"bench","slot":3}]') $$, '23514', null, 'bench players have no slot');

-- Sections
select lives_ok($$ insert into public.plan_sections (id, plan_id, section_type, title, tactic_id, sort_order) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'board', 'Shape', 'a1000000-0000-0000-0000-000000000001', 0),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'notes', 'Pressing', null, 1),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'reminders', 'Remember', null, 2) $$, 'owner adds sections');
select throws_ok($$ insert into public.plan_sections (plan_id, section_type, title, tactic_id, sort_order)
  values ('d0000000-0000-0000-0000-000000000001', 'board', 'Stolen', 'b1000000-0000-0000-0000-000000000001', 3) $$,
  '23514', null, 'another team''s tactic cannot be attached');
select throws_ok($$ insert into public.plan_sections (plan_id, section_type, title, tactic_id, sort_order)
  values ('d0000000-0000-0000-0000-000000000001', 'notes', 'Bad', 'a1000000-0000-0000-0000-000000000001', 3) $$,
  '23514', null, 'only board sections attach tactics');
select lives_ok($$ select public.move_plan_section('e0000000-0000-0000-0000-000000000003', -1) $$, 'move a section up');
select is((select array_agg(title::text order by sort_order) from public.plan_sections), array['Shape', 'Remember', 'Pressing'], 'order swapped');
select lives_ok($$ select public.move_plan_section('e0000000-0000-0000-0000-000000000001', -1) $$, 'moving the first section up is a no-op');

update public.match_plans set objective = 'Win the second balls';
select is((select version from public.match_plans), 2, 'plan version bumps on update');

-- Other user B ---------------------------------------------------------------
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.matches) + (select count(*)::int from public.match_plans)
  + (select count(*)::int from public.lineup_assignments) + (select count(*)::int from public.plan_sections), 0, 'B sees none of A''s plan data');
select throws_ok($$ select public.save_lineup('d0000000-0000-0000-0000-000000000001', '[]') $$, '42501', null, 'B cannot overwrite A''s lineup');
select throws_ok($$ select public.move_plan_section('e0000000-0000-0000-0000-000000000001', 1) $$, '42501', null, 'B cannot reorder A''s sections');
update public.match_plans set objective = 'Hijacked';
select throws_ok($$ insert into public.matches (team_id, opponent_name, kickoff_at, kickoff_tz, match_format)
  values ('11111111-0000-0000-0000-000000000001', 'Planted', now(), 'UTC', 5) $$, '42501', null, 'B cannot add fixtures to A''s team');

select set_config('role', 'anon', true);
select throws_ok($$ select * from public.matches $$, '42501', null, 'anon has no access');

-- Back to A: integrity on delete ------------------------------------------------
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select is((select objective::text from public.match_plans), 'Win the second balls', 'B''s update had no effect');
delete from public.tactics where id = 'a1000000-0000-0000-0000-000000000001';
select is((select tactic_id from public.plan_sections where id = 'e0000000-0000-0000-0000-000000000001'), null, 'deleting a tactic detaches it from sections');
select is((select count(*)::int from public.lineup_assignments where player_id = 'a0000000-0000-0000-0000-000000000001'), 1,
  'archiving keeps lineup rows (players are never hard-deleted)');
delete from public.matches where id = 'c0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.match_plans) + (select count(*)::int from public.plan_sections) + (select count(*)::int from public.lineup_assignments), 0,
  'deleting a fixture removes its plan, sections and lineup');

select * from finish();
rollback;
