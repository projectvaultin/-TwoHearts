-- Groups table
create table if not exists public.groups(
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  avatar_url  text,
  member_count integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Add group_id to conversations if not exists
alter table public.conversations
  add column if not exists group_id uuid references public.groups(id) on delete cascade;

-- Conversation members
create table if not exists public.conversation_members(
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  role            text not null default 'member',
  joined_at       timestamptz not null default now(),
  muted_until     timestamptz,
  primary key(conversation_id, user_id)
);

-- Group invites
create table if not exists public.group_invites(
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token      text unique not null,
  expires_at timestamptz,
  max_uses   integer,
  use_count  integer not null default 0,
  created_at timestamptz not null default now()
);

-- Admin
create table if not exists public.admin_users(
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_sessions(
  id             uuid primary key default gen_random_uuid(),
  admin_id       uuid not null references auth.users(id) on delete cascade,
  elevated_until timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists public.admin_access_logs(
  id              uuid primary key default gen_random_uuid(),
  admin_id        uuid not null references auth.users(id) on delete cascade,
  action          text not null,
  target_user_id  uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  reason          text,
  ticket_id       text,
  created_at      timestamptz not null default now()
);

-- Risk and fraud
create table if not exists public.fraud_signals(
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  signal_type text not null,
  score       integer not null default 0,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.user_risk_profiles(
  user_id     uuid primary key references auth.users(id) on delete cascade,
  risk_score  integer not null default 0,
  flags       text[] not null default '{}',
  reviewed_at timestamptz,
  updated_at  timestamptz not null default now()
);

-- Verification
create table if not exists public.identity_verifications(
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  status            text not null default 'pending',
  age_verified      boolean,
  liveness_result   text,
  face_match_result text,
  expires_at        timestamptz,
  storage_path      text,
  provider_ref      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.verification_consents(
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  consent_type text not null,
  consented    boolean not null,
  consented_at timestamptz not null default now()
);

create table if not exists public.verification_events(
  id              uuid primary key default gen_random_uuid(),
  verification_id uuid references public.identity_verifications(id) on delete cascade,
  event_type      text not null,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists public.verification_reviewers(
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_reports(
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid references public.reports(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  action_taken text,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.retention_policies(
  id              uuid primary key default gen_random_uuid(),
  table_name      text not null,
  retention_days  integer not null,
  last_cleaned_at timestamptz,
  created_at      timestamptz not null default now()
);

-- RLS for new tables
alter table public.groups enable row level security;
alter table public.conversation_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.admin_access_logs enable row level security;
alter table public.fraud_signals enable row level security;
alter table public.user_risk_profiles enable row level security;
alter table public.identity_verifications enable row level security;
alter table public.verification_consents enable row level security;
alter table public.verification_events enable row level security;
alter table public.verification_reviewers enable row level security;
alter table public.moderation_reports enable row level security;

-- Users can only see groups they are members of
create policy "member sees own groups" on public.groups
  for select using (
    exists (
      select 1 from public.conversation_members cm
      join public.conversations c on c.id = cm.conversation_id
      where c.group_id = groups.id and cm.user_id = auth.uid()
    )
  );

-- Users see their own conversation memberships
create policy "own conversation members" on public.conversation_members
  for all using (user_id = auth.uid());

-- Verification: users see only their own
create policy "own verification" on public.identity_verifications
  for all using (user_id = auth.uid());

create policy "own verification consents" on public.verification_consents
  for all using (user_id = auth.uid());

-- Admin tables: no direct client access (use Edge Functions only)
create policy "no direct admin access" on public.admin_users
  for all using (false);

create policy "no direct admin sessions" on public.admin_sessions
  for all using (false);

create policy "no direct admin logs" on public.admin_access_logs
  for all using (false);

-- Risk: no direct client access
create policy "no direct fraud signals" on public.fraud_signals
  for all using (false);

create policy "no direct risk profiles" on public.user_risk_profiles
  for all using (false);

-- Matches table (for friend/random connections outside couple system)
create table if not exists public.matches (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references auth.users(id) on delete cascade,
  user_b     uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'pending',  -- pending, matched, declined, blocked
  message    text,
  matched_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_a, user_b)
);

alter table public.matches enable row level security;

-- Users can see their own matches only
create policy "own matches" on public.matches
  for all using (user_a = auth.uid() or user_b = auth.uid());

-- Media table (for vault and couple media)
create table if not exists public.media (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid references public.couples(id) on delete cascade,
  uploaded_by  uuid not null references auth.users(id) on delete cascade,
  file_name    text,
  file_type    text,
  storage_path text not null,
  is_vault     boolean not null default false,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);

alter table public.media enable row level security;

-- Only couple members can see their media
create policy "couple media access" on public.media
  for all using (
    exists (
      select 1 from public.couples c
      where c.id = media.couple_id
      and (c.partner_a = auth.uid() or c.partner_b = auth.uid())
    )
  );

-- Security events (for screen capture logging)
create table if not exists public.security_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  event_type text not null,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.security_events enable row level security;

-- Users can only insert their own security events (not read others')
create policy "insert own security events" on public.security_events
  for insert with check (user_id = auth.uid());

create policy "read own security events" on public.security_events
  for select using (user_id = auth.uid());

-- Important dates (add recurring and reminder_days columns)
alter table public.important_dates
  add column if not exists recurring      text    not null default 'yearly',
  add column if not exists reminder_days  integer not null default 7;

-- Add reply_to_id to messages if not present
alter table public.messages
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null,
  add column if not exists read_at      timestamptz;

-- Add nickname and avatar_url to couples if not present
alter table public.couples
  add column if not exists nickname    text,
  add column if not exists avatar_url  text;

-- Add location column to profiles
alter table public.profiles
  add column if not exists location text;
