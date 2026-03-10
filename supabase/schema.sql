create extension if not exists pgcrypto;

create table if not exists guild_members (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,
  username text,
  nickname text,
  avatar_hash text,
  avatar_url text,
  roles jsonb default '[]'::jsonb,
  top_role text,
  joined_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (guild_id, user_id)
);

create table if not exists guild_roles (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  role_id text not null,
  name text not null,
  position integer not null default 0,
  member_count integer default 0,
  unique (guild_id, role_id)
);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,
  username text,
  title text not null,
  category text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  claimed_by text,
  closed_by text,
  closed_reason text,
  initial_message text,
  ai_category_confidence numeric(5,2) default 0,
  mod_suggestion text,
  mod_suggestion_confidence numeric(5,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  closed_at timestamptz
);

create table if not exists ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  author_id text not null,
  author_name text,
  content text not null,
  message_type text not null default 'staff',
  created_at timestamptz default now()
);

create table if not exists ticket_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  staff_id text not null,
  staff_name text,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists ticket_categories (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  name text not null,
  slug text not null,
  color text default '#45d483',
  created_at timestamptz default now(),
  unique (guild_id, slug)
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  event_type text not null,
  related_id text,
  created_at timestamptz default now()
);

create table if not exists staff_metrics (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  staff_id text not null,
  staff_name text,
  tickets_handled integer default 0,
  approvals integer default 0,
  denials integer default 0,
  avg_response_minutes integer default 0,
  last_active timestamptz default now(),
  unique (guild_id, staff_id)
);

create table if not exists warns (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,
  username text,
  reason text not null,
  source_message text,
  created_at timestamptz default now()
);

create table if not exists raid_events (
  id uuid primary key default gen_random_uuid(),
  guild_id text default '',
  join_count integer not null default 0,
  window_seconds integer not null default 0,
  severity text not null,
  summary text not null,
  created_at timestamptz default now()
);

create table if not exists member_joins (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,
  username text,
  joined_at timestamptz default now()
);

create table if not exists verification_flags (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,
  username text,
  score integer not null default 0,
  reasons jsonb default '[]'::jsonb,
  flagged boolean not null default false,
  created_at timestamptz default now()
);

insert into ticket_categories (guild_id, name, slug, color)
values ('demo', 'Verification Issue', 'verification_issue', '#45d483')
on conflict do nothing;

do $$
begin
  begin
    alter publication supabase_realtime add table tickets;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table ticket_messages;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table ticket_notes;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table ticket_categories;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table audit_events;
  exception when duplicate_object then null; end;
end $$;
