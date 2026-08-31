# Screen capture protection

## Android/WebAPK

For the native Android wrapper, set:

WindowManager.LayoutParams.FLAG_SECURE

on every sensitive activity/window.

Also disable recents/overview screenshots where appropriate and use Android's screen-capture callback on supported Android versions.

This can block normal screenshots and screen recording of the protected app surface on supported Android implementations.

## Important limitation

A website running in an ordinary browser cannot reliably prevent the operating system's screenshot or screen-recording facilities. Therefore the strongest protection requires the Android wrapper/native layer.

No software can prevent someone from using another phone/camera to photograph the display.

## Policy

Protected screens:
- chat
- media viewer
- private vault
- profiles
- group chat
- calls
- admin chat viewer

If capture is detected where the platform provides detection:
1. immediately blur/protect content
2. record a security event
3. optionally terminate the session
4. notify the account owner
5. apply configured risk policy

Do not attempt hidden surveillance or bypass platform security controls.
