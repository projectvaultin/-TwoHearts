# Database

Primary files:
- supabase/schema.sql
- supabase/rls.sql
- supabase/realtime.sql
- supabase/storage-policies.sql

Required negative tests:
- unpaired user cannot read couple data
- unrelated user cannot read messages
- logged-out user cannot access private data
- storage object access is denied outside the couple
- revoked/deleted account loses access
