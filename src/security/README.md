# Security layer

The production application must use an established, audited end-to-end encryption protocol/library.

These files intentionally do not invent cryptography. They define boundaries for:
- identity/device keys
- session lifecycle
- encrypted message payloads
- encrypted media
- vault keys

Do not ship custom cryptographic primitives.
