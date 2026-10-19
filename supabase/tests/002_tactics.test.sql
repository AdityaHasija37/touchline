-- TAC-03 / SEC-01 / QA-02 / QA-04 at the database layer.
begin;
select plan(17);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.test');
insert into public.teams (id, owner_id, name, match_format) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A Seven', 7),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'A Five', 5),
  ('22222222-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'B Team', 7);

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select ok((select relrowsecurity from pg_class where oid = 'public.tactics'::regclass), 'RLS on tactics');

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.tactics (id, team_id, name, format, board_json, version) values
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Shape', 7,
   '{"schemaVersion":1,"format":7,"orientation":"vertical","objects":[]}', 99) $$, 'owner creates a tactic');
select is((select version from public.tactics), 1, 'client cannot choose the initial version');

update public.tactics set name = 'Renamed shape';
select is((select version from public.tactics), 1, 'rename does not bump version');

update public.tactics set board_json = '{"schemaVersion":1,"format":7,"orientation":"vertical","objects":[{"id":"b","kind":"ball","x":50,"y":50}]}';
select is((select version from public.tactics), 2, 'board change bumps version');

-- Stale write from a second tab still holding version 1 matches no rows.
update public.tactics set board_json = '{"schemaVersion":1,"format":7,"orientation":"vertical","objects":[]}'
  where id = '33333333-0000-0000-0000-000000000001' and version = 1;
select is((select jsonb_array_length(board_json -> 'objects') from public.tactics), 1, 'stale expected-version write is a no-op');

select throws_ok($$ update public.tactics set version = 50 $$, '42501', null, 'version column is not client-writable');
select throws_ok($$ update public.tactics set team_id = '11111111-0000-0000-0000-000000000002' $$, '42501', null, 'tactics cannot move teams');
select throws_ok($$ insert into public.tactics (team_id, name, format, board_json) values
  ('11111111-0000-0000-0000-000000000001', 'Bad', 7, '{"schemaVersion":1,"format":11,"orientation":"vertical","objects":[]}') $$,
  '23514', null, 'board format must match column');
select throws_ok($$ insert into public.tactics (team_id, name, format, board_json) values
  ('11111111-0000-0000-0000-000000000001', 'Bad', 7, '{"schemaVersion":2,"format":7,"objects":[]}') $$,
  '23514', null, 'unknown schema version rejected');
select throws_ok($$ insert into public.tactics (team_id, name, format, board_json) values
  ('11111111-0000-0000-0000-000000000001', 'Bad', 7, '{"schemaVersion":1,"format":7,"objects":{}}') $$,
  '23514', null, 'objects must be an array');
select throws_ok($$ insert into public.tactics (team_id, name, format, category, board_json) values
  ('11111111-0000-0000-0000-000000000001', 'Bad', 7, 'magic', '{"schemaVersion":1,"format":7,"objects":[]}') $$,
  '23514', null, 'unknown category rejected');

select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.tactics), 0, 'B cannot read A tactics');
update public.tactics set name = 'Hijacked';
delete from public.tactics;
select throws_ok($$ insert into public.tactics (team_id, name, format, board_json) values
  ('11111111-0000-0000-0000-000000000001', 'Planted', 7, '{"schemaVersion":1,"format":7,"objects":[]}') $$,
  '42501', null, 'B cannot add tactics to A team');

select set_config('role', 'anon', true);
select throws_ok($$ select * from public.tactics $$, '42501', null, 'anon has no access');

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select is((select name::text from public.tactics), 'Renamed shape', 'B update/delete had no effect');
delete from public.teams where id = '11111111-0000-0000-0000-000000000001';
select is((select count(*)::int from public.tactics), 0, 'team deletion cascades to tactics');

select * from finish();
rollback;
