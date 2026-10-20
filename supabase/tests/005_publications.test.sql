-- PRES-02 / SEC-01: publication privacy, token lookup, revocation and rate limiting.
begin;
select plan(24);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.test');
insert into public.teams (id, owner_id, name, match_format) values ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A Five', 5);
insert into public.matches (id, team_id, opponent_name, kickoff_at, kickoff_tz, match_format)
  values ('c0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Dynamos', now(), 'UTC', 5);
insert into public.match_plans (id, match_id) values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001');

-- A 43-char base64url token and its hash, as the app computes them.
create temp table t as select 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde'::text as token,
  encode(sha256(convert_to('AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde', 'UTF8')), 'hex') as hash,
  repeat('a', 64) as client;
grant select on t to authenticated, anon, service_role;

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select ok((select bool_and(relrowsecurity) from pg_class where oid in
  ('public.published_plans'::regclass, 'public.audit_events'::regclass, 'public.share_lookup_counters'::regclass)), 'RLS on publication tables');

-- Owner publishes -------------------------------------------------------------
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.published_plans (plan_id, share_token_hash, snapshot_json, slide_count)
  select 'd0000000-0000-0000-0000-000000000001', hash, '{"version":1,"title":"Briefing"}', 3 from t $$, 'owner publishes');
select is((select slide_count from public.published_plans), 3, 'owner reads publication metadata');
select throws_ok($$ select share_token_hash from public.published_plans $$, '42501', null, 'the token hash is not readable, even by the owner');
select throws_ok($$ insert into public.published_plans (plan_id, share_token_hash, snapshot_json, slide_count)
  values ('d0000000-0000-0000-0000-000000000001', repeat('b', 64), '{"version":1}', 1) $$, '23505', null, 'only one live link per plan');
select lives_ok($$ insert into public.audit_events (team_id, action, resource_type, resource_id)
  select '11111111-0000-0000-0000-000000000001', 'plan_published', 'published_plan', id from public.published_plans $$, 'owner records an audit event');
select throws_ok($$ select public.get_published_snapshot('x', repeat('a', 64)) $$, '42501', null, 'signed-in users cannot call the lookup directly');

-- Other user ----------------------------------------------------------------------
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.published_plans), 0, 'B cannot see A''s publications');
update public.published_plans set revoked_at = now();
select throws_ok($$ insert into public.published_plans (plan_id, share_token_hash, snapshot_json, slide_count)
  values ('d0000000-0000-0000-0000-000000000001', repeat('c', 64), '{"version":1}', 1) $$, '42501', null, 'B cannot publish A''s plan');
select throws_ok($$ insert into public.audit_events (team_id, action, resource_type, resource_id)
  values ('11111111-0000-0000-0000-000000000001', 'share_revoked', 'published_plan', gen_random_uuid()) $$, '42501', null, 'B cannot write A''s audit log');

-- Anonymous: no tables, no RPC (all public access goes through the app server) ------
select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from public.published_plans $$, '42501', null, 'anon cannot read publications');
select throws_ok($$ select public.get_published_snapshot('x', repeat('a', 64)) $$, '42501', null, 'anon cannot call the lookup directly (no limit bypass)');
select throws_ok($$ select * from public.share_lookup_counters $$, '42501', null, 'anon cannot see rate counters');

-- App server (service_role) ---------------------------------------------------------
select set_config('role', 'service_role', true);
select is((select public.get_published_snapshot(token, client) ->> 'status' from t), 'ok', 'valid token resolves');
select is((select public.get_published_snapshot(token, client) -> 'snapshot' ->> 'title' from t), 'Briefing', 'returns only the snapshot');
select is((select public.get_published_snapshot('ZZZZEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde', client) ->> 'status' from t), 'not_found', 'unknown token is not found');
select is((select public.get_published_snapshot('short', client) ->> 'status' from t), 'not_found', 'malformed token is not found');
select is((select public.get_published_snapshot(token, 'not-a-hash') ->> 'status' from t), 'not_found', 'malformed client key is refused');

-- Rate limit: 60 lookups per client per minute. 4 counted so far (the malformed-client call returns before counting).
select is((select count(*)::int from (select public.get_published_snapshot(token, client) from t, generate_series(1, 56)) x), 56, 'burn the rest of the minute');
select is((select public.get_published_snapshot(token, client) ->> 'status' from t), 'rate_limited', '61st lookup in a minute is limited');
select is((select public.get_published_snapshot(token, repeat('b', 64)) ->> 'status' from t), 'ok', 'other clients are unaffected');

-- Revocation ------------------------------------------------------------------------
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
update public.published_plans set revoked_at = now() where plan_id = 'd0000000-0000-0000-0000-000000000001';
select throws_ok($$ update public.published_plans set revoked_at = null $$, '42501', null, 'revocation cannot be undone');
select set_config('role', 'service_role', true);
select is((select public.get_published_snapshot(token, repeat('c', 64)) ->> 'status' from t), 'not_found', 'revoked token looks exactly like an unknown one');

-- Deleting the fixture removes its publications --------------------------------------
reset role;
delete from public.matches where id = 'c0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.published_plans where plan_id = 'd0000000-0000-0000-0000-000000000001'), 0, 'fixture deletion removes its links (DEC-07)');

select * from finish();
rollback;
