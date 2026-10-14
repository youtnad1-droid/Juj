
create table public.login_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  ip text not null,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index on public.login_attempts(email, created_at desc);
create index on public.login_attempts(ip, created_at desc);
grant all on public.login_attempts to service_role;
alter table public.login_attempts enable row level security;
-- no policies: only the server (service role) can read/write
