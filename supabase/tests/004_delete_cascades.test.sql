-- Regression: deleting a team or account with lineups cascades; users still can't delete players.
begin;
select plan(4);

insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.test');
insert into public.teams (id, owner_id, name, match_format) values ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A Five', 5);
insert into public.players (id, team_id, name) values ('a0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Sam');
insert into public.matches (id, team_id, opponent_name, kickoff_at, kickoff_tz, match_format)
  values ('c0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Dynamos', now(), 'UTC', 5);
insert into public.match_plans (id, match_id) values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001');
insert into public.lineup_assignments (plan_id, player_id, role) values ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'starter');

select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$ delete from public.players where id = 'a0000000-0000-0000-0000-000000000001' $$, '42501', null,
  'the owner cannot hard-delete a player who is in a lineup (archive only)');
reset role;

savepoint before_team_delete;
select lives_ok($$ delete from public.teams where id = '11111111-0000-0000-0000-000000000001' $$, 'deleting a team with lineups cascades');
select is((select count(*)::int from public.lineup_assignments), 0, 'lineups removed with the team');
rollback to savepoint before_team_delete;

select lives_ok($$ delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$, 'deleting an account with lineups cascades');

select * from finish();
rollback;
