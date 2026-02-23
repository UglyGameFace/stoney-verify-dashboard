-- Optional table for the dashboard audit panel.
-- Service role bypasses RLS, but you can keep RLS ON and block anon access.

create table if not exists public.verification_audit_logs (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  action text not null,
  actor_discord_id text,
  actor_username text,
  token text,
  meta jsonb not null default '{}'::jsonb
);

alter table public.verification_audit_logs enable row level security;

-- No public select/insert by default
