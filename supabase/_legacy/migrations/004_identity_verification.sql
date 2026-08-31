-- TwoHearts v1.2: identity + 30-second selfie-video verification.

create table if not exists public.identity_verifications(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_reference text,
  status text not null default 'pending',
  identity_verified boolean not null default false,
  age_verified boolean not null default false,
  liveness_verified boolean not null default false,
  face_match_verified boolean not null default false,
  selfie_video_object text,
  selfie_video_sha256 text,
  verification_started_at timestamptz,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_reason text
);

create table if not exists public.verification_events(
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.identity_verifications(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  reason text,
  case_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.verification_consents(
  user_id uuid primary key references auth.users(id) on delete cascade,
  selfie_video_consent boolean not null default false,
  biometric_processing_consent boolean not null default false,
  consent_version text not null,
  consented_at timestamptz,
  withdrawn_at timestamptz
);

create table if not exists public.verification_reviewers(
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  role text not null default 'verification_reviewer',
  created_at timestamptz not null default now()
);

alter table public.identity_verifications enable row level security;
alter table public.verification_events enable row level security;
alter table public.verification_consents enable row level security;
alter table public.verification_reviewers enable row level security;

-- A user can see only their own verification status/metadata.
-- Do NOT expose the actual selfie video through normal client queries.
create policy verification_self_select
on public.identity_verifications for select to authenticated
using(user_id=auth.uid());

create policy verification_self_insert
on public.identity_verifications for insert to authenticated
with check(user_id=auth.uid());

create policy verification_self_update
on public.identity_verifications for update to authenticated
using(user_id=auth.uid())
with check(user_id=auth.uid());

create policy verification_consent_self
on public.verification_consents for all to authenticated
using(user_id=auth.uid())
with check(user_id=auth.uid());

-- Verification events are accessed through privileged server-side functions.
-- Do not create a broad reviewer policy that exposes verification media.
