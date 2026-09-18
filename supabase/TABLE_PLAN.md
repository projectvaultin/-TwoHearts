# TwoHearts v2 — Supabase table plan

## Deployment order
Run **only** `supabase/RESET_AND_BUILD.sql` in the Supabase SQL Editor.

It is the single canonical script:
1. Deletes the old TwoHearts application tables, storage objects/buckets and old helper functions/triggers.
2. Recreates the complete existing schema.
3. Adds the v2 extensible workspace tables.
4. Reapplies RLS, storage policies and realtime publication entries.
5. Runs one final verification query.

**Warning:** the reset step is destructive for TwoHearts application data. It intentionally does not delete `auth.users`.

## Existing application tables rebuilt
profiles, privacy_settings, user_devices, couples, couple_members, matches,
conversations, messages, message_reactions, message_receipts, media, memories,
memory_media, timeline_events, journal_entries, important_dates, surprises,
calls, call_signals, game_sessions, game_answers, notification_preferences,
blocks, reports, security_events, groups, conversation_members, group_invites,
identity_verifications, verification_consents, verification_events,
verification_reviewers, moderation_reports, admin_users, admin_sessions,
admin_access_logs, fraud_signals, user_risk_profiles, retention_policies.

## New v2 tables
- `user_feature_settings` — feature-center favorites/layout preferences
- `shared_tasks` — couple tasks and assignments
- `relationship_goals` — shared goals and progress
- `bucket_list_items` — shared experiences/wishlist
- `gratitude_entries` — shared gratitude journal
- `shared_polls` — shared questions/polls
- `shared_poll_options` — poll choices
- `shared_poll_votes` — member votes

## Why the old SQL files are removed
The repository previously contained legacy schema/migration/RLS files plus a consolidated script. Keeping multiple authoritative schema paths is a common source of drift. v2 intentionally ships one source of truth: `RESET_AND_BUILD.sql`.
