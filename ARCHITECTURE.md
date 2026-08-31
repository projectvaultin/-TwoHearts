# Architecture

Client
  -> Supabase Auth
  -> PostgreSQL + RLS
  -> Realtime
  -> Storage
  -> Edge Functions

Calls
  -> authenticated signaling
  -> WebRTC
  -> TURN fallback

Privacy model target
  client encrypts sensitive content
  -> backend stores ciphertext
  -> authorized client decrypts

The final E2EE protocol and device/key model must be selected and audited before production.
