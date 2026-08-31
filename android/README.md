# Android security wrapper

Use this as the basis for the final WebAPK/native wrapper.

Protected screens should inherit from SecureActivity so Android's FLAG_SECURE prevents the protected app surface from appearing in screenshots and non-secure displays where supported.

Do not claim absolute screenshot prevention: external cameras and unsupported platform capture paths cannot be controlled by an app.

Add screenshot detection callbacks on supported Android versions as a secondary security signal.
