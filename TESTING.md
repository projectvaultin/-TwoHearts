# Testing plan

Auth:
- registration/login/logout/recovery
- session revocation

Couple isolation:
- A/B access works
- C cannot access A/B

Chat:
- send/receive
- realtime
- receipts
- reactions
- delete
- disappearing messages
- encrypted attachments

Calls:
- permissions
- ringing/accept/decline
- reconnect
- TURN fallback
- hangup

Privacy:
- no plaintext sensitive content
- no service-role key in bundle
- storage authorization
- RLS negative tests

Deletion:
- auth
- profile
- couple membership
- messages/media
- storage objects
- devices
