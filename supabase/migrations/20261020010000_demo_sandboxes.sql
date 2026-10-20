-- 0007 One-click demo sandboxes (DEC-48). Each "Try the demo" creates a private, pre-filled account
-- that is deleted after 24 hours. Everything here is callable only by the app server (service_role).

create table public.demo_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index demo_accounts_created_at_idx on public.demo_accounts (created_at);

create table public.demo_rate (
  client_hash char(64) not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (client_hash, window_start)
);

alter table public.demo_accounts enable row level security;
alter table public.demo_rate enable row level security;
revoke all on public.demo_accounts, public.demo_rate from anon, authenticated;

-- At most 5 sandboxes per client per hour, and 300 live sandboxes overall.
create or replace function public.claim_demo_slot(p_client_hash text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  win timestamptz := date_trunc('hour', now());
  n int;
begin
  if p_client_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  if (select count(*) from public.demo_accounts) >= 300 then
    return false;
  end if;
  insert into public.demo_rate as r (client_hash, window_start, hits) values (p_client_hash, win, 1)
  on conflict (client_hash, window_start) do update set hits = r.hits + 1
  returning hits into n;
  delete from public.demo_rate where window_start < win - interval '1 day';
  return n <= 5;
end;
$$;

-- Deletes sandboxes older than 24 h. Deleting the auth user cascades to all of its data and links.
create or replace function public.cleanup_demo_accounts()
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n int;
begin
  with gone as (
    delete from auth.users u using public.demo_accounts d
    where d.user_id = u.id and d.created_at < now() - interval '24 hours'
    returning u.id
  )
  select count(*) into n from gone;
  return n;
end;
$$;

revoke execute on function public.claim_demo_slot(text), public.cleanup_demo_accounts() from public, anon, authenticated;
grant execute on function public.claim_demo_slot(text), public.cleanup_demo_accounts() to service_role;
grant select, insert on public.demo_accounts to service_role;
