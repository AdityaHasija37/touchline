-- Smoke test: proves pgTAP runs against the local stack. Real RLS suites start in Phase 1.
begin;
select plan(2);
select has_schema('public');
select has_schema('auth');
select * from finish();
rollback;
