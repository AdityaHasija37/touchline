-- SEC-01 / QA-02 at the database layer: anon, owner (A) and another user (B).
begin;
select plan(24);

-- Fixtures --------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.test', '{"display_name":"Captain A"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.test', '{}');

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_anon() returns void language sql as $$
  select set_config('role', 'anon', true),
         set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;

-- Structure ---------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS on profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.teams'::regclass), 'RLS on teams');
select ok((select relrowsecurity from pg_class where oid = 'public.players'::regclass), 'RLS on players');
select is((select display_name::text from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
          'Captain A', 'profile created on sign-up');

-- Owner A creates data -----------------------------------------------------
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.teams (id, name, match_format) values
  ('11111111-0000-0000-0000-000000000001', 'Sunday Rovers', 7),
  ('11111111-0000-0000-0000-000000000002', 'Rovers Reserves', 5) $$, 'owner creates teams');
select lives_ok($$ insert into public.players (id, team_id, name, shirt_number, preferred_positions)
  values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Sam Keeper', 1, '{GK}') $$,
  'owner adds a player');
select is((select count(*)::int from public.teams), 2, 'owner sees own teams');
select is((select owner_id from public.teams limit 1), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'owner_id defaults to caller');
select throws_ok($$ delete from public.players where id = '22222222-0000-0000-0000-000000000001' $$,
  '42501', null, 'players cannot be hard-deleted (archive only)');
select lives_ok($$ update public.players set archived_at = now() where id = '22222222-0000-0000-0000-000000000001' $$,
  'owner archives a player');
select throws_ok($$ update public.players set team_id = '11111111-0000-0000-0000-000000000002'
  where id = '22222222-0000-0000-0000-000000000001' $$, '42501', null, 'players cannot move between teams');

-- Validation constraints ---------------------------------------------------
select throws_ok($$ insert into public.teams (name, match_format) values ('X', 7) $$, '23514', null, 'team name min 2 chars');
select throws_ok($$ insert into public.teams (name, match_format) values ('Nines', 9) $$, '23514', null, '9v9 rejected');
select throws_ok($$ insert into public.teams (name, match_format, primary_color) values ('Bad Colour', 7, 'green!!') $$,
  '23514', null, 'colour must be hex');
select throws_ok($$ insert into public.players (team_id, name, preferred_positions)
  values ('11111111-0000-0000-0000-000000000001', 'Pat', '{STRIKER}') $$, '23514', null, 'unknown position rejected');

-- Other user B sees and changes nothing -----------------------------------
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.teams), 0, 'B cannot read A teams');
select is((select count(*)::int from public.players), 0, 'B cannot read A players');
select is((select count(*)::int from public.profiles), 1, 'B reads only own profile');
update public.teams set name = 'Hijacked' where id = '11111111-0000-0000-0000-000000000001';
delete from public.teams where id = '11111111-0000-0000-0000-000000000001';
select throws_ok($$ insert into public.players (team_id, name)
  values ('11111111-0000-0000-0000-000000000001', 'Intruder') $$, '42501', null, 'B cannot add players to A team');
select throws_ok($$ insert into public.teams (owner_id, name, match_format)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Spoofed', 7) $$, '42501', null, 'B cannot create teams as A');

-- Anonymous has no table access at all -------------------------------------
select pg_temp.as_anon();
select throws_ok($$ select * from public.teams $$, '42501', null, 'anon cannot select teams');
select throws_ok($$ select * from public.players $$, '42501', null, 'anon cannot select players');

-- Back as A: B's update/delete had no effect; team deletion cascades -------
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select is((select name::text from public.teams where id = '11111111-0000-0000-0000-000000000001'),
          'Sunday Rovers', 'B update and delete affected nothing');
delete from public.teams where id = '11111111-0000-0000-0000-000000000001';
select is((select count(*)::int from public.players), 0, 'deleting a team removes its players');

select * from finish();
rollback;
