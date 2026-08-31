-- ================================================================
-- TWOHEARTS -- SINGLE SETUP SCRIPT (run this on a clean database,
-- ideally right after 1_DELETE_ALL.sql)
-- ================================================================
-- This replaces running schema.sql + all 6 files in supabase/migrations/
-- + rls.sql + storage-policies.sql + realtime.sql separately. Those
-- files are kept in the repo for reference/history, but running them
-- one by one is what caused schema drift last time (later files
-- silently no-op against tables the earlier file already created).
-- This script is the single corrected result of that whole chain,
-- built from an actual audit of what the app code queries -- not
-- just what the migration files intended.
--
-- Safe to re-run: every statement uses IF NOT EXISTS / OR REPLACE,
-- so running it again later (e.g. after adding a new page) won't
-- break anything already there.
-- ================================================================

begin;

create extension if not exists pgcrypto;

-- ================================================================
-- 1. CORE TABLES (from schema.sql, unchanged -- this file was
--    already internally consistent)
-- ================================================================

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
 avatar_url text,
 pairing_code_hash text,
 pairing_expires_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(partner_b is null or partner_a<>partner_b)
);
create unique index if not exists couples_a_unique on public.couples(partner_a);
create unique index if not exists couples_b_unique on public.couples(partner_b) where partner_b is not null;
alter table public.couples add column if not exists avatar_url text;

create table if not exists public.couple_members(
 couple_id uuid references public.couples(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(couple_id,user_id)
);
create unique index if not exists one_couple_per_user on public.couple_members(user_id);

-- Connection requests between users (used by discover/connect/dm/notifications).
-- Not present in the original schema.sql -- added here from actual app usage.
create table if not exists public.matches(
 id uuid primary key default gen_random_uuid(),
 user_a uuid not null references public.profiles(id) on delete cascade,
 user_b uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending',
 message text,
 matched_at timestamptz,
 created_at timestamptz not null default now(),
 check(user_a<>user_b),
 constraint matches_user_a_fkey foreign key (user_a) references public.profiles(id) on delete cascade
);
create index if not exists matches_user_a_idx on public.matches(user_a);
create index if not exists matches_user_b_idx on public.matches(user_b);

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
 read_at timestamptz,
 created_at timestamptz not null default now(),
 edited_at timestamptz,
 deleted_at timestamptz
);
create index if not exists messages_conversation_created on public.messages(conversation_id,created_at desc);
alter table public.messages add column if not exists read_at timestamptz;

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
 kind text not null default 'file',
 storage_path text not null,
 encrypted_file_key text,
 encrypted_metadata text,
 file_size bigint,
 mime_type text,
 original_filename text,
 -- compatibility columns: the vault upload page (vault.js) uses this
 -- naming instead of owner_id/original_filename/mime_type/file_size
 uploaded_by uuid references auth.users(id) on delete cascade,
 file_name text,
 file_type text,
 is_vault boolean not null default false,
 size_bytes bigint,
 created_at timestamptz not null default now()
);
alter table public.media alter column kind drop not null;
alter table public.media alter column kind set default 'file';
alter table public.media add column if not exists uploaded_by uuid references auth.users(id) on delete cascade;
alter table public.media add column if not exists file_name text;
alter table public.media add column if not exists file_type text;
alter table public.media add column if not exists is_vault boolean not null default false;
alter table public.media add column if not exists size_bytes bigint;

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
 -- compatibility columns: important-dates.js writes these names directly
 recurring text,
 reminder_days integer,
 created_at timestamptz not null default now()
);
alter table public.important_dates add column if not exists recurring text;
alter table public.important_dates add column if not exists reminder_days integer;

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
 status text not null default 'pending',
 -- compatibility columns: dm.js / chat.js write these names directly
 reported_id uuid references auth.users(id) on delete set null,
 context_type text,
 created_at timestamptz not null default now()
);
alter table public.reports add column if not exists status text not null default 'pending';
alter table public.reports add column if not exists reported_id uuid references auth.users(id) on delete set null;
alter table public.reports add column if not exists context_type text;
update public.reports set reported_id = reported_user_id where reported_id is null and reported_user_id is not null;
update public.reports set reported_user_id = reported_id where reported_user_id is null and reported_id is not null;

create table if not exists public.security_events(
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete set null,
 event_type text not null,
 device_id uuid references public.user_devices(id) on delete set null,
 created_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb
);

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

-- ================================================================
-- 2. Profile auto-creation trigger (from migrations/005)
-- ================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, created_at, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'display_name', 'New User'),
    now(),
    now()
  )
  on conflict (id) do nothing;

  insert into public.privacy_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.notification_preferences (user_id) values (new.id) on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ================================================================
-- 3. Helper functions used by RLS policies
-- ================================================================
create or replace function public.is_couple_member(target_couple_id uuid)
returns boolean language sql stable security invoker as $$
select exists(select 1 from public.couple_members where couple_id=target_couple_id and user_id=auth.uid());
$$;

create or replace function public.is_conversation_member(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
select exists(select 1 from public.conversation_members cm where cm.conversation_id=target_conversation_id and cm.user_id=auth.uid());
$$;

-- SECURITY: fails closed -- a row with is_active left null is NOT treated as an active admin.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
select exists(select 1 from public.admin_users a where a.user_id = auth.uid() and coalesce(a.is_active,false) = true);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ================================================================
-- 4. RLS -- core tables (from rls.sql, unchanged)
-- ================================================================
do $$ declare t text; begin
foreach t in array[
'profiles','privacy_settings','user_devices','couples','couple_members','conversations',
'messages','message_reactions','message_receipts','media','memories','memory_media',
'timeline_events','journal_entries','important_dates','surprises','calls','call_signals',
'game_sessions','game_answers','notification_preferences','blocks','reports','security_events',
'matches','groups','conversation_members','group_invites','admin_users','admin_sessions',
'admin_access_logs','fraud_signals','user_risk_profiles','identity_verifications',
'verification_consents','verification_events','verification_reviewers','moderation_reports',
'retention_policies'
] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;

do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname='public' loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy profiles_self_insert on public.profiles for insert to authenticated with check(id=auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy profiles_self_select on public.profiles for select to authenticated using(true);

create policy privacy_self on public.privacy_settings for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy devices_self on public.user_devices for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create policy couples_select on public.couples for select to authenticated using(partner_a=auth.uid() or partner_b=auth.uid());
create policy couples_insert on public.couples for insert to authenticated with check(partner_a=auth.uid());
create policy couples_update on public.couples for update to authenticated using(partner_a=auth.uid() or partner_b=auth.uid()) with check(partner_a=auth.uid() or partner_b=auth.uid());

create policy members_select on public.couple_members for select to authenticated using(public.is_couple_member(couple_id));
create policy members_insert_self on public.couple_members for insert to authenticated with check(user_id=auth.uid());

create policy conversations_select on public.conversations for select to authenticated
  using((couple_id is not null and public.is_couple_member(couple_id)) or (group_id is not null and public.is_conversation_member(id)));
create policy conversations_insert on public.conversations for insert to authenticated
  with check((couple_id is not null and public.is_couple_member(couple_id)) or group_id is not null);

create policy messages_select on public.messages for select to authenticated using(exists(select 1 from public.conversations c where c.id=conversation_id and (public.is_couple_member(c.couple_id) or public.is_conversation_member(c.id))));
create policy messages_insert on public.messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.conversations c where c.id=conversation_id and (public.is_couple_member(c.couple_id) or public.is_conversation_member(c.id))));
create policy messages_update_self on public.messages for update to authenticated using(sender_id=auth.uid() or exists(select 1 from public.conversations c where c.id=conversation_id and public.is_conversation_member(c.id))) with check(true);
create policy messages_delete_self on public.messages for delete to authenticated using(sender_id=auth.uid());

create policy reactions_select on public.message_reactions for select to authenticated using(exists(select 1 from public.messages m join public.conversations c on c.id=m.conversation_id where m.id=message_id and (public.is_couple_member(c.couple_id) or public.is_conversation_member(c.id))));
create policy reactions_self on public.message_reactions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create policy receipts_select on public.message_receipts for select to authenticated using(exists(select 1 from public.messages m join public.conversations c on c.id=m.conversation_id where m.id=message_id and (public.is_couple_member(c.couple_id) or public.is_conversation_member(c.id))));
create policy receipts_self on public.message_receipts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create policy media_select on public.media for select to authenticated using(owner_id=auth.uid() or uploaded_by=auth.uid() or (couple_id is not null and public.is_couple_member(couple_id)));
create policy media_insert on public.media for insert to authenticated with check(owner_id=auth.uid() or uploaded_by=auth.uid());
create policy media_delete on public.media for delete to authenticated using(owner_id=auth.uid() or uploaded_by=auth.uid());

create policy memories_member on public.memories for all to authenticated using(public.is_couple_member(couple_id)) with check(public.is_couple_member(couple_id) and created_by=auth.uid());
create policy memory_media_select on public.memory_media for select to authenticated using(exists(select 1 from public.memories m where m.id=memory_id and public.is_couple_member(m.couple_id)));

create policy timeline_member on public.timeline_events for all to authenticated using(public.is_couple_member(couple_id)) with check(public.is_couple_member(couple_id) and created_by=auth.uid());
create policy journal_member on public.journal_entries for all to authenticated using(public.is_couple_member(couple_id)) with check(public.is_couple_member(couple_id) and created_by=auth.uid());
create policy dates_member on public.important_dates for all to authenticated using(public.is_couple_member(couple_id)) with check(public.is_couple_member(couple_id) and created_by=auth.uid());

create policy surprises_participant on public.surprises for select to authenticated using(sender_id=auth.uid() or recipient_id=auth.uid());
create policy surprises_insert on public.surprises for insert to authenticated with check(sender_id=auth.uid() and public.is_couple_member(couple_id));

create policy calls_participant on public.calls for select to authenticated using(caller_id=auth.uid() or receiver_id=auth.uid());
create policy calls_insert on public.calls for insert to authenticated with check(caller_id=auth.uid() and public.is_couple_member(couple_id));
create policy calls_update on public.calls for update to authenticated using(caller_id=auth.uid() or receiver_id=auth.uid()) with check(caller_id=auth.uid() or receiver_id=auth.uid());

create policy signals_select on public.call_signals for select to authenticated using(exists(select 1 from public.calls c where c.id=call_id and (c.caller_id=auth.uid() or c.receiver_id=auth.uid())));
create policy signals_insert on public.call_signals for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.calls c where c.id=call_id and (c.caller_id=auth.uid() or c.receiver_id=auth.uid())));

create policy games_member on public.game_sessions for all to authenticated using(public.is_couple_member(couple_id)) with check(public.is_couple_member(couple_id) and created_by=auth.uid());
create policy answers_select on public.game_answers for select to authenticated using(exists(select 1 from public.game_sessions g where g.id=session_id and public.is_couple_member(g.couple_id)));
create policy answers_insert on public.game_answers for insert to authenticated with check(user_id=auth.uid());

create policy notification_self on public.notification_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy blocks_self on public.blocks for all to authenticated using(blocker_id=auth.uid()) with check(blocker_id=auth.uid());

-- reports: reporter can see their own; admins can see and update all
create policy reports_insert on public.reports for insert to authenticated with check(reporter_id=auth.uid());
create policy reports_select on public.reports for select to authenticated using(reporter_id=auth.uid() or public.is_admin());
create policy reports_admin_update on public.reports for update to authenticated using(public.is_admin()) with check(public.is_admin());

create policy security_events_select on public.security_events for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy security_events_insert on public.security_events for insert to authenticated with check(true);

-- ================================================================
-- 5. RLS -- matches (connection requests)
-- ================================================================
create policy matches_select on public.matches for select to authenticated using(user_a=auth.uid() or user_b=auth.uid());
create policy matches_insert on public.matches for insert to authenticated with check(user_a=auth.uid());
create policy matches_update on public.matches for update to authenticated using(user_a=auth.uid() or user_b=auth.uid()) with check(user_a=auth.uid() or user_b=auth.uid());

-- ================================================================
-- 6. RLS -- groups / conversation_members / group_invites
-- ================================================================
create policy groups_select on public.groups for select to authenticated
  using(owner_id=auth.uid() or exists(select 1 from public.conversation_members cm join public.conversations c on c.id=cm.conversation_id where c.group_id=groups.id and cm.user_id=auth.uid()));
create policy groups_insert on public.groups for insert to authenticated with check(owner_id=auth.uid());
create policy groups_update on public.groups for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy groups_delete on public.groups for delete to authenticated using(owner_id=auth.uid());

create policy conversation_members_select on public.conversation_members for select to authenticated using(user_id=auth.uid() or public.is_conversation_member(conversation_id));
create policy conversation_members_insert_self on public.conversation_members for insert to authenticated with check(user_id=auth.uid());
create policy conversation_members_insert_owner on public.conversation_members for insert to authenticated with check(exists(select 1 from public.conversations c join public.groups g on g.id=c.group_id where c.id=conversation_id and g.owner_id=auth.uid()));
create policy conversation_members_delete_self on public.conversation_members for delete to authenticated using(user_id=auth.uid());

create policy group_invites_select on public.group_invites for select to authenticated using(created_by=auth.uid() or exists(select 1 from public.groups g where g.id=group_id and g.owner_id=auth.uid()));
create policy group_invites_insert on public.group_invites for insert to authenticated with check(exists(select 1 from public.groups g where g.id=group_id and g.owner_id=auth.uid()));

-- ================================================================
-- 7. RLS -- verification (self + admin)
-- ================================================================
create policy verification_select on public.identity_verifications for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy verification_insert on public.identity_verifications for insert to authenticated with check(user_id=auth.uid());
create policy verification_update on public.identity_verifications for update to authenticated using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());

create policy verification_consents_self on public.verification_consents for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy verification_events_select on public.verification_events for select to authenticated using(public.is_admin() or exists(select 1 from public.identity_verifications v where v.id=verification_id and v.user_id=auth.uid()));
create policy verification_reviewers_admin on public.verification_reviewers for select to authenticated using(public.is_admin());

create policy moderation_reports_admin on public.moderation_reports for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- ================================================================
-- 8. RLS -- admin-only tables
-- ================================================================
create policy admin_users_self_select on public.admin_users for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy admin_sessions_self on public.admin_sessions for select to authenticated using(admin_id=auth.uid());
create policy admin_logs_select on public.admin_access_logs for select to authenticated using(admin_id=auth.uid() or public.is_admin());
create policy admin_logs_insert on public.admin_access_logs for insert to authenticated with check(public.is_admin() and admin_id=auth.uid());
create policy fraud_signals_admin on public.fraud_signals for select to authenticated using(public.is_admin());
create policy risk_profiles_admin on public.user_risk_profiles for select to authenticated using(public.is_admin());
create policy retention_policies_admin on public.retention_policies for select to authenticated using(public.is_admin());

commit;

-- ================================================================
-- 9. Storage buckets + policies (separate statements -- storage.objects
--    RLS uses its own policy catalog, not the app tables above)
-- ================================================================
begin;

-- avatars and couple-media are used with getPublicUrl() by the app,
-- so they need to be public buckets. couple-vault and verification-media
-- are used with createSignedUrl() and must stay private.
insert into storage.buckets (id, name, public) values ('avatars','avatars', true) on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('couple-media','couple-media', true) on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('couple-vault','couple-vault', false) on conflict (id) do update set public = false;
insert into storage.buckets (id, name, public) values ('verification-media','verification-media', false) on conflict (id) do update set public = false;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname='storage' and tablename='objects'
    and policyname like 'th\_%' escape '\'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- avatars: path is 'avatars/{uid}.{ext}' -- owner can write, anyone can read (public bucket)
create policy "th_avatars_read" on storage.objects for select using (bucket_id='avatars');
create policy "th_avatars_write" on storage.objects for insert to authenticated with check (bucket_id='avatars' and split_part(name,'/',2) like (auth.uid()::text || '.%'));
create policy "th_avatars_update" on storage.objects for update to authenticated using (bucket_id='avatars' and split_part(name,'/',2) like (auth.uid()::text || '.%'));

-- couple-media: path is 'couple-media/{couple_id}/...' -- couple members can write, anyone can read (public bucket)
create policy "th_couple_media_read" on storage.objects for select using (bucket_id='couple-media');
create policy "th_couple_media_write" on storage.objects for insert to authenticated with check (bucket_id='couple-media' and public.is_couple_member((split_part(name,'/',2))::uuid));
create policy "th_couple_media_update" on storage.objects for update to authenticated using (bucket_id='couple-media' and public.is_couple_member((split_part(name,'/',2))::uuid));
create policy "th_couple_media_delete" on storage.objects for delete to authenticated using (bucket_id='couple-media' and public.is_couple_member((split_part(name,'/',2))::uuid));

-- couple-vault: path is '{couple_id}/{uid}/...' -- private, only couple members can read/write
create policy "th_couple_vault_all" on storage.objects for all to authenticated
  using (bucket_id='couple-vault' and public.is_couple_member((split_part(name,'/',1))::uuid))
  with check (bucket_id='couple-vault' and public.is_couple_member((split_part(name,'/',1))::uuid));

-- verification-media: path is '{uid}/...' -- private, only the owner or an admin
create policy "th_verification_media_owner" on storage.objects for all to authenticated
  using (bucket_id='verification-media' and (split_part(name,'/',1) = auth.uid()::text or public.is_admin()))
  with check (bucket_id='verification-media' and split_part(name,'/',1) = auth.uid()::text);

commit;

-- ================================================================
-- 10. Realtime -- actually enable it (source file had this
--     commented out, so nothing was ever live)
-- ================================================================
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.message_reactions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.message_receipts;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.calls;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.call_signals;
exception when duplicate_object then null; end $$;

-- ================================================================
-- VERIFICATION -- should return exactly one row with status = 'PASS'
-- ================================================================
select
  'TWOHEARTS SETUP' as verification,
  now() as checked_at,
  case when
    to_regclass('public.matches') is not null
    and to_regclass('public.profiles') is not null
    and to_regprocedure('public.is_admin()') is not null
    and to_regprocedure('public.handle_new_user()') is not null
    and exists(select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='reported_id')
    and exists(select 1 from information_schema.columns where table_schema='public' and table_name='media' and column_name='uploaded_by')
    and exists(select 1 from information_schema.columns where table_schema='public' and table_name='couples' and column_name='avatar_url')
    and exists(select 1 from storage.buckets where id='avatars')
    and exists(select 1 from storage.buckets where id='couple-vault')
  then 'PASS' else 'FAIL' end as status;
