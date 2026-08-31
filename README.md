# TwoHearts

A privacy-first private space for couples — chat, calls, memories, journal, surprises, and more.

Built with: Vite (multi-page), Supabase (Auth + Postgres + Realtime + Storage), vanilla JS.

## Setup

### 1. Environment
A `.env` file is included and git-ignored. If missing, create it:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

### 2. Database
Run these SQL files in your Supabase SQL editor, in order:
```
supabase/schema.sql
supabase/migrations/001_initial.sql
supabase/migrations/002_rls.sql
supabase/migrations/003_groups_admin_security.sql
supabase/migrations/004_identity_verification.sql
supabase/migrations/005_profile_trigger.sql   ← important: auto-creates profile on signup
supabase/migrations/006_groups_conversations_admin.sql
supabase/rls.sql
supabase/storage-policies.sql
supabase/realtime.sql
```

### 3. Storage buckets
Create these as **private** buckets in Supabase Storage (toggle OFF "Public bucket"):
- `couple-media`
- `couple-vault`
- `verification-media`
- `avatars`

### 4. Install and run
```
npm install
npm run dev
```

### 5. Build for production
```
npm run build
npm run preview
```

## Deployment (Vercel)
1. Connect GitHub repo to Vercel
2. Add environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. In Supabase → Authentication → URL Configuration, add your Vercel URL to Site URL and Redirect URLs

## Features
| Feature | Status |
|---|---|
| Auth (register/login/logout/forgot password) | ✅ Implemented |
| Profile (load/save) | ✅ Implemented |
| Couple pairing (create code / join) | ✅ Implemented |
| Chat with Realtime | ✅ Implemented |
| Memories | ✅ Implemented |
| Timeline | ✅ Implemented |
| Journal | ✅ Implemented |
| Surprises | ✅ Implemented |
| Privacy settings | ✅ Implemented |
| Notification preferences | ✅ Implemented |
| Devices (view/revoke) | ✅ Implemented |
| Games (Know Me / This or That / Daily Question) | ✅ Implemented |
| Group chat | ✅ Implemented |
| Verification (camera capture + upload) | ✅ Implemented |
| Admin role guard | ✅ Implemented |
| PWA (all pages cached, private data never cached) | ✅ Implemented |
| WebRTC voice/video calls | ⚙️ Requires TURN server + signaling Edge Function |
| E2EE encryption | ⚙️ Requires production key management |
| Identity verification review | ⚙️ Requires external liveness provider |
| Push notifications | ⚙️ Requires push provider (FCM/APNs) |
| Edge Functions (19 functions) | ⚙️ Stubs — require server-side implementation + secrets |

## Edge Functions requiring deployment
Deploy via `supabase functions deploy <name>`. Each requires secrets set in Supabase dashboard:
- `create-pairing` / `complete-pairing` — couple pairing
- `call-signaling` / `create-turn-credentials` — WebRTC (needs TURN_SECRET)
- `start-verification` / `process-verification` — identity verification (needs VERIFICATION_PROVIDER_KEY)
- `upload-verification-video` / `delete-verification-media` — verification media
- `review-verification` — admin verification review
- `admin-search-conversations` / `admin-view-conversation` — admin chat access
- `admin-moderation` / `admin-revoke-session` — admin moderation
- `send-notification` — push notifications (needs FCM_KEY or similar)
- `reveal-surprise` — timed surprise reveal
- `delete-account` — full account deletion (needs service role)
- `cleanup-expired-data` — scheduled data retention cleanup
- `security-event` — fraud/security event logging

## Security notes
- No service_role key is used in frontend code anywhere
- All admin operations go through Edge Functions (server-side only)
- Private storage uses signed URLs, not public URLs
- RLS is enabled on every table
- Admin and verification tables have no direct client-side access policies

## Supabase URL Configuration (required)

In Supabase dashboard → Authentication → URL Configuration, set:

**Site URL:**
```
https://your-vercel-url.vercel.app
```

**Redirect URLs (add all of these):**
```
https://your-vercel-url.vercel.app/app.html
https://your-vercel-url.vercel.app/reset-password.html
https://your-vercel-url.vercel.app/verify-email.html
https://your-vercel-url.vercel.app/onboarding.html
```

This ensures password reset emails and email confirmation links redirect correctly.

## New pages in this version
- `/onboarding.html` — 3-step first-time setup
- `/verify-email.html` — email confirmation with resend
- `/reset-password.html` — password reset landing page
- `/important-dates.html` — dates with countdown reminders
- `/blocked-users.html` — view and unblock users
- `/notifications.html` — real notification inbox
- `/connect.html` — find people by username or QR code
- `/dm.html` — direct messages with connections
- `/offline.html` — offline fallback page
