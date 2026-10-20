-- Enhancements 1, 2, 4, 5: roles/duties, formation, set pieces and sub plan at the database layer.
begin;
select plan(15);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.test');
insert into public.teams (id, owner_id, name, match_format) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A Five', 5);
insert into public.players (id, team_id, name)
select ('a0000000-0000-0000-0000-00000000000' || g)::uuid, '11111111-0000-0000-0000-000000000001', 'A player ' || g from generate_series(1, 6) g;
insert into public.matches (id, team_id, opponent_name, kickoff_at, kickoff_tz, match_format)
  values ('c0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Dynamos', '2026-10-25 14:00+01', 'Europe/London', 5);
insert into public.match_plans (id, match_id) values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok($$ select public.save_lineup('d0000000-0000-0000-0000-000000000001',
  '[{"playerId":"a0000000-0000-0000-0000-000000000001","role":"starter","slot":1,"playerRole":"sweeper_keeper","duty":"support","instruction":" Play short "},
    {"playerId":"a0000000-0000-0000-0000-000000000002","role":"starter","slot":3,"playerRole":"full_back","duty":"attack"},
    {"playerId":"a0000000-0000-0000-0000-000000000003","role":"bench"}]') $$, 'save lineup with roles, duties and explicit slots');
select is((select instruction::text from public.lineup_assignments where player_id = 'a0000000-0000-0000-0000-000000000001'), 'Play short', 'instruction trimmed');
select is((select formation_slot::int from public.lineup_assignments where player_id = 'a0000000-0000-0000-0000-000000000002'), 3, 'explicit slot kept');
select is((select duty from public.lineup_assignments where player_id = 'a0000000-0000-0000-0000-000000000002'), 'attack', 'duty stored');
select throws_ok($$ select public.save_lineup('d0000000-0000-0000-0000-000000000001',
  '[{"playerId":"a0000000-0000-0000-0000-000000000003","role":"bench","duty":"attack"}]') $$, '23514', null, 'bench players have no role or duty');
select throws_ok($$ select public.save_lineup('d0000000-0000-0000-0000-000000000001',
  '[{"playerId":"a0000000-0000-0000-0000-000000000001","role":"starter","slot":1,"duty":"chaos"}]') $$, '23514', null, 'unknown duty rejected');
select throws_ok($$ select public.save_lineup('d0000000-0000-0000-0000-000000000001',
  '[{"playerId":"a0000000-0000-0000-0000-000000000001","role":"starter","slot":1,"playerRole":"Robert''); drop table x;--"}]') $$, '23514', null, 'role key must be a slug');

select lives_ok($$ update public.match_plans set formation_id = '5-22',
  set_pieces = '{"captain":"a0000000-0000-0000-0000-000000000001","marking":[]}',
  sub_plan = '{"matchLength":40,"subs":[]}' $$, 'owner sets formation, set pieces and sub plan');
select throws_ok($$ update public.match_plans set formation_id = '4-4-2; drop' $$, '23514', null, 'formation id format checked');
select throws_ok($$ update public.match_plans set set_pieces = '[]' $$, '23514', null, 'set pieces must be an object');
select throws_ok($$ update public.match_plans set sub_plan = jsonb_build_object('pad', repeat('x', 9000)) $$, '23514', null, 'sub plan size capped');

select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
update public.match_plans set formation_id = '5-121', set_pieces = '{"captain":"evil"}';
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select is((select formation_id::text from public.match_plans), '5-22', 'another user cannot change the formation');
select is((select set_pieces ->> 'captain' from public.match_plans), 'a0000000-0000-0000-0000-000000000001', 'another user cannot change set pieces');

select ok(public.analytics_props_ok('plan_published', '{"slide_count":6,"format":7,"has_formation":1,"roles_count":7,"set_piece_jobs":5,"subs_count":3}'), 'adoption counts allowed on plan_published');
select ok(not public.analytics_props_ok('plan_published', '{"roles":"Pressing forward"}'), 'role text never allowed in analytics');

select * from finish();
rollback;
