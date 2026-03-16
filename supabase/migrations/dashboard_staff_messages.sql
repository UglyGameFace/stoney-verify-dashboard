begin;

create extension if not exists pgcrypto;

create table if not exists public.dashboard_staff_messages (
  id uuid primary key default gen_random_uuid(),

  guild_id text not null,
  channel_id text not null,
  message_id text not null,
  author_id text not null,

  author_username text,
  author_display_name text,
  author_avatar_url text,

  content text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  embeds jsonb not null default '[]'::jsonb,

  is_staff boolean not null default false,
  is_bot boolean not null default false,
  is_deleted boolean not null default false,
  edited boolean not null default false,

  created_at timestamptz not null default timezone('utc', now()),
  edited_at timestamptz,
  deleted_at timestamptz,

  raw_payload jsonb not null default '{}'::jsonb,

  constraint dashboard_staff_messages_message_unique unique (message_id)
);

create index if not exists idx_dashboard_staff_messages_guild_created
  on public.dashboard_staff_messages (guild_id, created_at desc);

create index if not exists idx_dashboard_staff_messages_guild_channel_created
  on public.dashboard_staff_messages (guild_id, channel_id, created_at desc);

create index if not exists idx_dashboard_staff_messages_author
  on public.dashboard_staff_messages (author_id, created_at desc);

create index if not exists idx_dashboard_staff_messages_is_staff
  on public.dashboard_staff_messages (guild_id, is_staff, created_at desc);

create index if not exists idx_dashboard_staff_messages_not_deleted
  on public.dashboard_staff_messages (guild_id, is_deleted, created_at desc);

alter table public.dashboard_staff_messages enable row level security;

drop policy if exists "dashboard_staff_messages_select_authenticated" on public.dashboard_staff_messages;
create policy "dashboard_staff_messages_select_authenticated"
on public.dashboard_staff_messages
for select
to authenticated
using (true);

drop policy if exists "dashboard_staff_messages_insert_service_role" on public.dashboard_staff_messages;
create policy "dashboard_staff_messages_insert_service_role"
on public.dashboard_staff_messages
for insert
to service_role
with check (true);

drop policy if exists "dashboard_staff_messages_update_service_role" on public.dashboard_staff_messages;
create policy "dashboard_staff_messages_update_service_role"
on public.dashboard_staff_messages
for update
to service_role
using (true)
with check (true);

drop policy if exists "dashboard_staff_messages_delete_service_role" on public.dashboard_staff_messages;
create policy "dashboard_staff_messages_delete_service_role"
on public.dashboard_staff_messages
for delete
to service_role
using (true);

commit;
