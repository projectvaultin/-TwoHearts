-- TwoHearts v1.1: group conversations + admin security/audit.
-- Apply after schema.sql and rls.sql.

create table if not exists public.conversation_members(
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key(conversation_id,user_id),
  constraint conversation_member_role check(role in ('member','moderator','owner'))
);

create table if not exists public.groups(
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid unique not null references public.conversations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  avatar_path text,
  max_members integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.group_invites(
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  invite_token_hash text not null unique,
  expires_at timestamptz not null,
  max_uses integer not null default 1,
  used_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_reports(
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  reported_user_id uuid references auth.users(id) on delete set null,
  category text not null,
  reason text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.admin_users(
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'support_admin',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint admin_role check(role in ('super_admin','security_admin','support_admin','moderator'))
);

create table if not exists public.admin_access_logs(
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text not null,
  ticket_id text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_sessions(
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.user_devices(id) on delete set null,
  elevated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists conversation_members_user_idx on public.conversation_members(user_id);
create index if not exists admin_access_logs_conversation_idx on public.admin_access_logs(conversation_id,created_at desc);
create index if not exists admin_access_logs_admin_idx on public.admin_access_logs(admin_user_id,created_at desc);

alter table public.conversation_members enable row level security;
alter table public.groups enable row level security;
alter table public.group_invites enable row level security;
alter table public.moderation_reports enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_access_logs enable row level security;
alter table public.admin_sessions enable row level security;

-- Regular users can only see their own conversation membership.
create policy conversation_members_self_select
on public.conversation_members for select to authenticated
using(user_id=auth.uid());

create policy conversation_members_self_insert
on public.conversation_members for insert to authenticated
with check(user_id=auth.uid());

create policy groups_member_select
on public.groups for select to authenticated
using(exists(
  select 1 from public.conversation_members cm
  where cm.conversation_id=groups.conversation_id
  and cm.user_id=auth.uid()
  and cm.left_at is null
));

create policy reports_self_insert
on public.moderation_reports for insert to authenticated
with check(reporter_id=auth.uid());

create policy reports_self_select
on public.moderation_reports for select to authenticated
using(reporter_id=auth.uid());

-- Admin access is intentionally NOT granted directly to admin_users through a broad
-- client-side RLS policy. All privileged content access must go through a server-side
-- Edge Function that verifies role + MFA/elevated session + reason/ticket + audit log.
