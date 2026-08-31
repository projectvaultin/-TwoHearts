# Security requirements

- Use an established audited E2EE protocol/library.
- Never invent cryptography.
- Do not store plaintext private messages/journal/surprises.
- Encrypt private media before upload.
- Keep service-role secrets server-side.
- Test RLS with multiple accounts and negative cases.
- Authenticate WebRTC signaling.
- Use short-lived TURN credentials.
- Avoid logging message/call content.
- Add rate limiting and abuse protection.
- Provide device/session revocation.
- Provide secure account deletion.
- Minimize metadata.
- Conduct an independent security review before launch.
