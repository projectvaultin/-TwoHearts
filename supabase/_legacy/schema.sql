create extension if not exists pgcrypto;

create table if not exists public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null,
 display_name text not null,
 avatar_url text,
 about text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint profiles_username_format check(username ~ '^[A-Za-z0-9_]{3,30}$')
);

create table if not exists public.privacy_settings(
 user_id uuid primary key references auth.users(id) on delete cascade,
 show_last_seen boolean not null default false,
 show_online_status boolean not null default false,
 read_receipts boolean not null default true,
 typing_indicator boolean not null default true,
 message_preview_notifications boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.user_devices(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 device_name text,
 platform text,
 public_key text,
 key_version integer not null default 1,
 last_seen_at timestamptz,
 created_at timestamptz not null default now(),
 revoked_at timestamptz
);

create table if not exists public.couples(
 id uuid primary key default gen_random_uuid(),
 partner_a uuid not null references auth.users(id) on delete cascade,
 partner_b uuid references auth.users(id) on delete set null,
 nickname text,
 relationship_date date,
 pairing_code_hash text,
 pairing_expires_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(partner_b is null or partner_a<>partner_b)
);
create unique index if not exists couples_a_unique on public.couples(partner_a);
create unique index if not exists couples_b_unique on public.couples(partner_b) where partner_b is not null;

create table if not exists public.couple_members(
 couple_id uuid references public.couples(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(couple_id,user_id)
);
create unique index if not exists one_couple_per_user on public.couple_members(user_id);

create table if not exists public.conversations(
 id uuid primary key default gen_random_uuid(),
 couple_id uuid unique references public.couples(id) on delete cascade,
 created_at timestamptz not null default now()
);

create table if not exists public.messages(
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 kind text not null default 'text',
 ciphertext text not null,
 encrypted_metadata text,
 reply_to_message_id uuid references public.messages(id) on delete set null,
 status text not null default 'sent',
 disappearing_after_seconds integer,
 created_at timestamptz not null default now(),
 edited_at timestamptz,
 deleted_at timestamptz
);
create index if not exists messages_conversation_created on public.messages(conversation_id,created_at desc);

create table if not exists public.message_reactions(
 message_id uuid references public.messages(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 reaction text not null,
 created_at timestamptz not null default now(),
 primary key(message_id,user_id,reaction)
);

create table if not exists public.message_receipts(
 message_id uuid references public.messages(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 delivered_at timestamptz,
 read_at timestamptz,
 primary key(message_id,user_id)
);

create table if not exists public.media(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 couple_id uuid references public.couples(id) on delete cascade,
 message_id uuid references public.messages(id) on delete cascade,
 kind text not null,
 storage_path text not null,
 encrypted_file_key text,
 encrypted_metadata text,
 file_size bigint,
 mime_type text,
 original_filename text,
 created_at timestamptz not null default now()
);

create table if not exists public.memories(
 id uuid primary key default gen_random_uuid(),
 couple_id uuid not null references public.couples(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade,
 title text not null,
 caption text,
 memory_date date not null default current_date,
 location_label text,
 created_at timestamptz not null default now()
);

create table if not exists public.memory_media(
 memory_id uuid references public.memories(id) on delete cascade,
 media_id uuid references public.media(id) on delete cascade,
 sort_order integer not null default 0,
 primary key(memory_id,media_id)
);

create table if not exists public.timeline_events(
 id uuid primary key default gen_random_uuid(),
 couple_id uuid not null references public.couples(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade,
 title text not null,
 description text,
 event_date date not null,
 icon text,
 created_at timestamptz not null default now()
);

create table if not exists public.journal_entries(
 id uuid primary key default gen_random_uuid(),
 couple_id uuid not null references public.couples(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade,
 ciphertext text not null,
 entry_date date not null default current_date,
 created_at timestamptz not null default now(),
 deleted_at timestamptz
);

create table if not exists public.important_dates(
 id uuid primary key default gen_random_uuid(),
 couple_id uuid not null references public.couples(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade,
 title text not null,
 event_date date not null,
 recurring_annually boolean not null default false,
 reminder_enabled boolean not null default true,
 reminder_days_before integer not null default 1,
 created_at timestamptz not null default now()
);

create table if not exists public.surprises(
 id uuid primary key default gen_random_uuid(),
 couple_id uuid not null references public.couples(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 ciphertext text not null,
 reveal_at timestamptz not null,
 opened_at timestamptz,
 created_at timestamptz not null default now(),
 cancelled_at timestamptz,
 check(sender_id<>recipient_id)
);

create table if not exists public.calls(
 id uuid primary key default gen_random_uuid(),
 couple_id uuid not null references public.couples(id) on delete cascade,
 caller_id uuid not null references auth.users(id) on delete cascade,
 receiver_id uuid not null references auth.users(id) on delete cascade,
 type text not null,
 status text not null default 'ringing',
 started_at timestamptz,
 answered_at timestamptz,
 ended_at timestamptz,
 created_at timestamptz not null default now(),
 check(caller_id<>receiver_id)
);

create table if not exists public.call_signals(
 id uuid primary key default gen_random_uuid(),
 call_id uuid not null references public.calls(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 signal_type text not null,
 encrypted_payload text not null,
 created_at timestamptz not null default now()
);

create table if not exists public.game_sessions(
 id uuid primary key default gen_random_uuid(),
 couple_id uuid not null references public.couples(id) on delete cascade,
 game_type text not null,
 created_by uuid not null references auth.users(id) on delete cascade,
 status text not null default 'active',
 created_at timestamptz not null default now()
);

create table if not exists public.game_answers(
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.game_sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 question_id text not null,
 ciphertext text not null,
 created_at timestamptz not null default now(),
 unique(session_id,user_id,question_id)
);

create table if not exists public.notification_preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 messages boolean not null default true,
 calls boolean not null default true,
 surprises boolean not null default true,
 important_dates boolean not null default true,
 thinking_of_you boolean not null default true,
 hide_message_preview boolean not null default true,
 created_at timestamptz not null default now()
);

create table if not exists public.blocks(
 blocker_id uuid references auth.users(id) on delete cascade,
 blocked_id uuid references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id),
 check(blocker_id<>blocked_id)
);

create table if not exists public.reports(
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid references auth.users(id) on delete cascade,
 reported_user_id uuid references auth.users(id) on delete set null,
 message_id uuid references public.messages(id) on delete set null,
 reason text not null,
 details text,
 created_at timestamptz not null default now()
);

create table if not exists public.security_events(
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete set null,
 event_type text not null,
 device_id uuid references public.user_devices(id) on delete set null,
 created_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb
);

-- Groups and conversation members (required for group chat)
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

alter table public.conversations
  add column if not exists group_id uuid references public.groups(id) on delete cascade;

create table if not exists public.conversation_members(
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  role            text not null default 'member',
  joined_at       timestamptz not null default now(),
  muted_until     timestamptz,
  primary key(conversation_id, user_id)
);

create table if not exists public.group_invites(
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.groups(id) on delete cascade,
  created_by      uuid not null references auth.users(id) on delete cascade,
  token           text unique not null,
  expires_at      timestamptz,
  max_uses        integer,
  use_count       integer not null default 0,
  created_at      timestamptz not null default now()
);

-- Admin tables
create table if not exists public.admin_users(
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_sessions(
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references auth.users(id) on delete cascade,
  elevated_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_access_logs(
  id             uuid primary key default gen_random_uuid(),
  admin_id       uuid not null references auth.users(id) on delete cascade,
  action         text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  reason         text,
  ticket_id      text,
  created_at     timestamptz not null default now()
);

-- Fraud and risk
create table if not exists public.fraud_signals(
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  signal_type text not null,
  score      integer not null default 0,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_risk_profiles(
  user_id     uuid primary key references auth.users(id) on delete cascade,
  risk_score  integer not null default 0,
  flags       text[] not null default '{}',
  reviewed_at timestamptz,
  updated_at  timestamptz not null default now()
);

-- Verification tables
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

-- Moderation
create table if not exists public.moderation_reports(
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid references public.reports(id) on delete cascade,
  reviewer_id     uuid references auth.users(id) on delete set null,
  action_taken    text,
  notes           text,
  created_at      timestamptz not null default now()
);

create table if not exists public.retention_policies(
  id              uuid primary key default gen_random_uuid(),
  table_name      text not null,
  retention_days  integer not null,
  last_cleaned_at timestamptz,
  created_at      timestamptz not null default now()
);
