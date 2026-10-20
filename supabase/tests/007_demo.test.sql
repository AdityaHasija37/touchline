-- Demo sandboxes: server-only, rate-limited, expire after 24 h with full cascade.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('dddddddd-0000-0000-0000-000000000001', 'old-demo@demo.touchline.invalid'),
  ('dddddddd-0000-0000-0000-000000000002', 'new-demo@demo.touchline.invalid'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'real@example.test');
insert into public.teams (owner_id, name, match_format) values ('dddddddd-0000-0000-0000-000000000001', 'Old demo team', 7);
insert into public.demo_accounts (user_id, created_at) values
  ('dddddddd-0000-0000-0000-000000000001', now() - interval '25 hours'),
  ('dddddddd-0000-0000-0000-000000000002', now() - interval '1 hour');

select set_config('role', 'anon', true);
select throws_ok($$ select public.claim_demo_slot(repeat('a', 64)) $$, '42501', null, 'anon cannot claim demo slots directly');
select set_config('role', 'authenticated', true);
select throws_ok($$ select public.expired_demo_accounts() $$, '42501', null, 'users cannot list expired sandboxes');
select throws_ok($$ select * from public.demo_accounts $$, '42501', null, 'users cannot list demo accounts');

select set_config('role', 'service_role', true);
select is((select count(*)::int from generate_series(1, 5) g where public.claim_demo_slot(repeat('a', 64))), 5, 'five sandboxes per client per hour');
select is(public.claim_demo_slot(repeat('a', 64)), false, 'the sixth is refused');
select is(public.claim_demo_slot(repeat('b', 64)), true, 'other clients are unaffected');
select is((select array_agg(id) from public.expired_demo_accounts() as id), array['dddddddd-0000-0000-0000-000000000001'::uuid],
  'only sandboxes older than 24 h are listed for deletion');

-- Deleting the user (as the admin API does) removes the sandbox and all its data.
reset role;
delete from auth.users where id = 'dddddddd-0000-0000-0000-000000000001';
select is((select count(*)::int from public.teams where name = 'Old demo team') + (select count(*)::int from public.demo_accounts where user_id = 'dddddddd-0000-0000-0000-000000000001'), 0,
  'deleting an expired sandbox user cascades to its data');

select * from finish();
rollback;
