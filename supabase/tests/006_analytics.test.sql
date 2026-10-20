-- PLAN-004 §5 analytics: allowlisted, pseudonymous, write-only.
begin;
select plan(11);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.test');
insert into public.teams (id, owner_id, name, match_format) values ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A Seven', 7);

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.events() returns int language sql security definer as $$
  select count(*)::int from public.analytics_events where team_ref = (select analytics_id from public.teams where id = '11111111-0000-0000-0000-000000000001');
$$;

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok($$ select analytics_id from public.teams $$, '42501', null, 'owners cannot read the analytics pseudonym');
select lives_ok($$ select name, match_format from public.teams $$, 'owners still read their team');
select lives_ok($$ select public.track_event('team_created', '11111111-0000-0000-0000-000000000001', '{"format":7}') $$, 'owner records an allowlisted event');
select is(pg_temp.events(), 1, 'event stored');
select public.track_event('player_added', '11111111-0000-0000-0000-000000000001', '{"name":"Sam Okafor"}');
select is(pg_temp.events(), 1, 'a non-allowlisted property (a name) is silently dropped');
select public.track_event('presentation_opened', '11111111-0000-0000-0000-000000000001', '{"viewer_type":"Sam Okafor"}');
select is(pg_temp.events(), 1, 'free-text values are refused');
select public.track_event('made_up_event', '11111111-0000-0000-0000-000000000001', '{}');
select is(pg_temp.events(), 1, 'unknown events are refused');
select throws_ok($$ select * from public.analytics_events $$, '42501', null, 'users cannot read analytics');

select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select public.track_event('team_created', '11111111-0000-0000-0000-000000000001', '{"format":7}');
select is(pg_temp.events(), 1, 'nobody can record events for another owner''s team');

select set_config('role', 'anon', true);
select throws_ok($$ select public.track_event('team_created', '11111111-0000-0000-0000-000000000001', '{}') $$, '42501', null, 'anon cannot track');

reset role;
delete from public.teams where id = '11111111-0000-0000-0000-000000000001';
select is((select count(*)::int from public.analytics_events e where not exists (select 1 from public.teams t where t.analytics_id = e.team_ref) and e.created_at > now() - interval '1 minute'), 1,
  'after team deletion its events remain only under an unlinkable pseudonym');

select * from finish();
rollback;
