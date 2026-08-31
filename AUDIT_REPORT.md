# TwoHearts — Full Audit Report (184-file package)

This audit is of `TwoHearts_GitHub_READY_FINAL_SUPABASE_CONNECTED.zip`, which you said contains
your complete original code. It is a genuinely more complete package than earlier uploads (real
Edge Function directories, an `android/` wrapper, organized `src/pages/app` and `src/pages/auth`
subfolders). This report only covers what was actually checked — see the "not checked" section
at the bottom.

## Real bugs found and fixed

### 1. Illegal syntax in `src/security/screen-guard.js`
`export function ...` statements were nested inside an `if {...} else {...}` block. `export` is
only legal at the top level of a JS module — this is a hard syntax error, not a style issue. Any
page importing this file (chat, vault, verification, admin, admin-verification, calls, couple,
groups — i.e. every "protected" page per the file's own comment) would fail to load. Fixed by
moving both exports to the top level and restructuring the protected-page check as an `if` block
that no longer contains the exports. Verified with `node --check` — clean.

### 2. `matches` table doesn't exist anywhere in the schema
`discover.js`, `connect.js`, `dm.js`, and `notifications.js` all query a `matches` table
(connection requests between users — pending/matched/declined/blocked) that isn't defined in
`schema.sql` or any migration. Every one of these pages would fail against a fresh database.
Added the table, matching the exact columns and the `matches_user_a_fkey` constraint name the
code expects for its `profiles!matches_user_a_fkey(...)` embedded select.

### 3. Four more real column-name mismatches between app code and schema
Found by cross-referencing every `.insert()`/`.update()` call against the actual table
definitions (not just spot-checking):
- **`important_dates`** — `important-dates.js` writes `recurring` and `reminder_days`; the schema
  only has `recurring_annually` and `reminder_days_before`. Added both as compatibility columns.
- **`reports`** — `dm.js` and `chat.js` write `reported_id` and `context_type`; the schema only
  has `reported_user_id` and no `context_type` at all. Added both, plus `status` (used by
  `admin.js` to filter/update reports — also missing).
- **`media`** — `vault.js` writes `uploaded_by`, `file_name`, `file_type`, `is_vault`,
  `size_bytes`; the schema only has `owner_id`, `original_filename`, `mime_type`, `file_size`,
  and no vault flag at all. Added all five as compatibility columns — this one would have broken
  the entire vault upload feature.
- **`couples`** — `couple.js` reads and writes `couples.avatar_url` for the couple's shared
  photo; the column doesn't exist in the schema at all. Added it.

### 4. Row Level Security was never enabled on 15 tables
`rls.sql` only enables RLS on the original 24 tables from the first schema generation. It never
covers `groups`, `conversation_members`, `group_invites`, `admin_users`, `admin_sessions`,
`admin_access_logs`, `fraud_signals`, `user_risk_profiles`, `identity_verifications`,
`verification_consents`, `verification_events`, `verification_reviewers`, `moderation_reports`,
`retention_policies` — all added later directly in `schema.sql` but never given policies. With
RLS disabled, Supabase's default is **open access** — meaning identity verification data
(including liveness/face-match results), admin user lists, and moderation records were all
readable and writable by any authenticated client. This is a real, serious security gap, not a
theoretical one. Fixed with RLS enabled and matching policies for every one of these tables in
the consolidated setup script.

### 5. Admin panel had no working access path under RLS
`admin.js` directly queries and updates `reports`, `identity_verifications`, and
`moderation_reports` for *all* users, not just the admin's own rows. The existing `rls.sql` only
lets a reporter see their own report — there was no admin-bypass policy anywhere, on any table.
Added an `is_admin()` helper (fails closed — a null `is_active` is never treated as active) and
admin-bypass `select`/`update` policies on the tables the admin panel actually touches.

### 6. Realtime was never actually turned on
`supabase/realtime.sql` only contains commented-out `alter publication` lines — nothing was ever
enabled. Chat, calls, and reactions have no live updates against a database built from these
files. Enabled it for `messages`, `message_reactions`, `message_receipts`, `calls`, and
`call_signals` in the consolidated script.

### 7. Storage buckets and policies were never actually created
`supabase/storage-policies.sql` is a comment placeholder with no real policies, and nothing
creates the buckets themselves. Also found a real inconsistency: the README says all 4 buckets
should be private, but the code calls `getPublicUrl()` (not `createSignedUrl()`) for `avatars`
and `couple-media` — which only works on a **public** bucket. `couple-vault` and
`verification-media` correctly use `createSignedUrl()` and should stay private. I followed what
the code actually does rather than the README: `avatars` and `couple-media` are created as public
buckets, `couple-vault` and `verification-media` as private with signed-URL-only access, each
with real path-based RLS policies matching the exact path conventions each page uses.

### 8. `esbuild` install-script warning (from your Vercel logs)
Added `"allowScripts": {"esbuild@0.28.2": true}` to `package.json` so npm 11.16+'s script-approval
gate doesn't skip esbuild's postinstall (which fetches its required native binary).

### 9. Committed `.env`
Removed. It only contained the Supabase URL and publishable anon key (not a secret), but
shouldn't be committed regardless — `.env.example` is kept.

## What I deliberately did NOT change
- **The 19 Supabase Edge Functions are still stubs** (`Deno.serve` returning `501 configured:false`
  for each). This matches what your own README already says, and implementing 19 privileged
  server-side functions (pairing, admin moderation, verification processing, TURN credentials,
  call signaling, etc.) is a much larger task than an audit-and-fix pass — flagging it clearly
  rather than writing untested server logic for sensitive operations like account deletion and
  identity verification.
- **`vite.config.js` has no `base` path set.** Earlier in this conversation you were deploying to
  GitHub Pages under `/-TwoHearts/`, which needs `base: '/-TwoHearts/'`. Since you're creating a
  new repo now, I left it unset (correct for Vercel or a custom domain). If the new repo ends up
  on GitHub Pages under a subpath, add `base: '/<your-new-repo-name>/'` back in — tell me the repo
  name and I'll do it for you.
- **`tests/` folder is empty.** No test files exist to audit; not something I can fix without
  writing new tests, which wasn't part of this request.

## The two SQL files
- **`supabase/1_DELETE_ALL.sql`** — drops every TwoHearts table, function, trigger, storage
  policy, and the 4 storage buckets. Does **not** delete your `auth.users` accounts — do that
  from the dashboard separately if you want those gone too. This is irreversible.
- **`supabase/2_CREATE_ALL.sql`** — the single consolidated script replacing `schema.sql` + all 6
  migration files + `rls.sql` + `storage-policies.sql` + `realtime.sql`. Running those 10 files
  separately, in the old repo, is exactly what caused the duplicate-column drift found in an
  earlier audit this session — this script is the corrected, deduplicated result of that whole
  chain, built from what the actual app code queries. Safe to re-run later (everything is
  `IF NOT EXISTS` / `OR REPLACE`). Ends with a verification `SELECT` that should return
  `status = 'PASS'`.

Run `1_DELETE_ALL.sql` then `2_CREATE_ALL.sql`, in that order, in the Supabase SQL Editor.

## Checks actually run (static — no network in this environment)
| Check | Result |
|---|---|
| `node --check` on all 45 `.js` files | **PASS** after fixing `screen-guard.js` |
| Every HTML `<script src>`/`<link href>` resolves to a real file | **PASS** (0 real issues) |
| Every relative JS `import` resolves to a real file | **PASS** |
| Automated scan of every `.insert()`/`.update()` call against actual schema columns | Found and fixed the 4 mismatches above (`important_dates`, `reports`, `media`, `couples`) |
| `package.json` dependencies vs actual imports | **PASS** |
| SQL structural check (`$$` balance, paren balance) on both new scripts | **PASS** |

## Still NOT run (no network access in this environment)
- `npm install` / `npm run build` — cannot execute here.
- The two new SQL scripts against a real Postgres instance — cannot execute here. Please run them
  and paste back the verification `SELECT` result (or any error) so I can confirm or fix further.
- Playwright/browser tests, live auth flow, live couple pairing between two accounts, live
  realtime chat — none of this was exercised.

## About "give you the URL and you add it directly"
I don't have a tool that can push commits to GitHub or write to a repo directly — I can only
read public files via a browser tool and generate files here for you to download. Once you create
the new repo, the fastest path is: extract the attached zip over the new repo's contents locally
(or upload the files through GitHub's web UI), commit, and push. If you give me the new repo's
name, I'll adjust `vite.config.js` for whichever hosting path you use.
