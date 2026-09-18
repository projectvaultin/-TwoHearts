# TwoHearts v2 upgrade

- Added a 156-module Feature Center with search, category filters and favorites.
- Added Supabase persistence for Feature Center favorites.
- Added extensible collaboration tables for tasks, goals, bucket list, gratitude and polls.
- Added RLS policies for every new table.
- Added realtime publication entries for shared tasks and polls.
- Added PWA registration to the existing frontend shell.
- Bumped the service-worker cache version and included Feature Center in the offline shell.
- Added Feature Center to the home quick-access grid and PWA shortcuts.
- Removed legacy/duplicate Supabase schema files from the deliverable to prevent schema drift.
- Added one canonical `supabase/RESET_AND_BUILD.sql`.
- Preserved the existing TwoHearts pages and Supabase client architecture.

The phrase “100000 updates” is treated as a request for a very large, scalable feature set rather than
literally shipping 100,000 separate code changes. The registry is designed so additional modules can
be added without redesigning navigation or the database each time.
