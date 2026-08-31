-- ================================================================
-- TWOHEARTS -- FULL WIPE (run this FIRST if resetting the project)
-- ================================================================
-- This drops every TwoHearts table, function, trigger, storage
-- policy and storage bucket. It does NOT touch auth.users (your
-- Supabase login accounts) -- if you also want to delete every
-- registered user, do that separately from Authentication > Users
-- in the dashboard, since bulk-deleting auth users from SQL is not
-- exposed the same way and doing it here would be riskier than
-- useful.
--
-- THIS IS IRREVERSIBLE. All couples, messages, media, memories,
-- verification data, admin records, etc. will be permanently
-- deleted. Do not run this against a project with real user data
-- you want to keep.
-- ================================================================

begin;

-- Drop trigger + function first (depends on nothing being dropped below)
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.is_couple_member(uuid);
drop function if exists public.is_admin();
drop function if exists public.is_conversation_member(uuid);

-- Drop tables (CASCADE clears dependent foreign keys/policies/indexes automatically)
drop table if exists public.retention_policies cascade;
drop table if exists public.moderation_reports cascade;
drop table if exists public.verification_reviewers cascade;
drop table if exists public.verification_events cascade;
drop table if exists public.verification_consents cascade;
drop table if exists public.identity_verifications cascade;
drop table if exists public.user_risk_profiles cascade;
drop table if exists public.fraud_signals cascade;
drop table if exists public.admin_access_logs cascade;
drop table if exists public.admin_sessions cascade;
drop table if exists public.admin_users cascade;
drop table if exists public.group_invites cascade;
drop table if exists public.conversation_members cascade;
drop table if exists public.groups cascade;
drop table if exists public.security_events cascade;
drop table if exists public.reports cascade;
drop table if exists public.blocks cascade;
drop table if exists public.notification_preferences cascade;
drop table if exists public.game_answers cascade;
drop table if exists public.game_sessions cascade;
drop table if exists public.call_signals cascade;
drop table if exists public.calls cascade;
drop table if exists public.surprises cascade;
drop table if exists public.important_dates cascade;
drop table if exists public.journal_entries cascade;
drop table if exists public.timeline_events cascade;
drop table if exists public.memory_media cascade;
drop table if exists public.memories cascade;
drop table if exists public.media cascade;
drop table if exists public.message_receipts cascade;
drop table if exists public.message_reactions cascade;
drop table if exists public.messages cascade;
drop table if exists public.conversations cascade;
drop table if exists public.matches cascade;
drop table if exists public.couple_members cascade;
drop table if exists public.couples cascade;
drop table if exists public.user_devices cascade;
drop table if exists public.privacy_settings cascade;
drop table if exists public.profiles cascade;

-- Storage: remove all objects in the app's buckets, then the buckets themselves
delete from storage.objects where bucket_id in ('couple-media','couple-vault','verification-media','avatars');
delete from storage.buckets where id in ('couple-media','couple-vault','verification-media','avatars');

-- Remove the app's tables from the realtime publication (harmless if not present)
do $$ begin
  alter publication supabase_realtime drop table public.messages;
exception when undefined_object or undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime drop table public.message_reactions;
exception when undefined_object or undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime drop table public.message_receipts;
exception when undefined_object or undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime drop table public.calls;
exception when undefined_object or undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime drop table public.call_signals;
exception when undefined_object or undefined_table then null; end $$;

commit;

select 'TwoHearts wipe complete. Run 2_CREATE_ALL.sql next.' as status;
