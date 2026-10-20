-- Hosted Supabase doesn't let the postgres role delete from auth.users directly, so expired
-- sandboxes are now *listed* here and deleted by the app server through the Auth admin API.
drop function if exists public.cleanup_demo_accounts();

create or replace function public.expired_demo_accounts(p_limit int default 50)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select user_id from public.demo_accounts
  where created_at < now() - interval '24 hours'
  order by created_at
  limit greatest(1, least(p_limit, 200));
$$;

revoke execute on function public.expired_demo_accounts(int) from public, anon, authenticated;
grant execute on function public.expired_demo_accounts(int) to service_role;
