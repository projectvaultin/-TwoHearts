# TwoHearts v1.1 — Product expansion

## Dating / relationship model
- 1-to-1 private conversations
- Couples can pair/unpair
- Optional dating profile
- Match/request/accept/block/report
- Relationship status
- Important dates
- Shared memories and timeline
- Private journal
- Scheduled surprises
- Couple games

## Group conversations
A conversation may contain 2, 3, 4 or more participants.
- group creation
- invite/remove participants
- admin/moderator roles
- group name/photo
- participant list
- reply/reaction/media
- per-message delivery/read state
- mute
- leave group
- report/block
- disappearing-message settings
- group audit events

## Strong privacy
- no application-provided screenshot button
- Android native/WebAPK wrapper should use FLAG_SECURE for sensitive activities
- screen-capture detection where supported
- block content from Android recent-apps screenshots
- no sensitive content in push notification previews
- prevent copy/share/download for protected content where technically possible
- watermark admin/audit views
- session/device management
- automatic session expiry for risky devices

Important limitation:
No normal app can guarantee that another physical camera will not photograph the screen. Screenshot/screen-recording prevention is platform-dependent. Android FLAG_SECURE can prevent the app window from appearing in screenshots and non-secure displays, but this must be implemented in the native Android wrapper. Android also provides screenshot-detection APIs on supported versions. See SECURITY_SCREEN_CAPTURE.md.
