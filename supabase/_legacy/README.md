# Legacy schema files — do not run these

These are the original schema.sql, rls.sql, storage-policies.sql, realtime.sql, and
migrations/001-006 from before the audit. They are kept here only for history/reference.

Running them (individually, in order) is what caused the schema drift documented in
AUDIT_REPORT.md — later files silently no-op against tables an earlier file already created,
leaving duplicate/conflicting columns behind.

Use ../1_DELETE_ALL.sql and ../2_CREATE_ALL.sql instead. Those two replace everything in this
folder with a single corrected, deduplicated setup.
