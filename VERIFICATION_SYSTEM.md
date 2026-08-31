# TwoHearts Verification System v1.2

## Required verified-user flow

1. Email verification
2. Phone verification
3. Age verification
4. Government-ID verification through a reputable identity provider
5. 30-second live selfie video
6. Liveness checks
7. Face-match checks against the identity-verification result
8. Fraud/risk screening
9. Verification decision
10. Messaging/dating access according to verification policy

## 30-second video

The video should be recorded inside the application and should use randomized prompts/actions such as:
- look straight
- turn left
- turn right
- blink
- smile
- read a generated phrase

The purpose is to make simple prerecorded submissions harder.

## Storage

Verification videos must NOT be mixed with ordinary chat media.

Use a private, separately controlled verification bucket such as:

verification-media/

The database should store only:
- verification ID
- user ID
- status
- provider/reference ID
- storage object reference
- liveness result
- face-match result
- created/updated timestamps
- retention/expiry metadata

The actual video is an encrypted private object.

## Access

Normal users: no access.
Other users: no access.
Moderators/support: no access by default.
Verification reviewers/security admins: only when necessary.

Privileged access requires:
- strong admin authentication
- MFA/passkey
- elevated short-lived session
- reason
- case/ticket ID
- server-side authorization
- audit log

## Important

A verification badge means the identity/verification process passed at a point in time. It does not guarantee that a user is trustworthy or that they can never scam someone. Continuous anti-fraud monitoring and reporting remain necessary.

Because the video can contain biometric information, the production system needs explicit consent, appropriate retention/deletion policies, encryption, restricted access and legal/privacy review for the regions where the service operates.
