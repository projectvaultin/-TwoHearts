package com.twohearts.security

import android.app.Activity
import android.os.Bundle
import android.view.WindowManager

/**
 * Native Android/WebAPK security wrapper.
 * Apply FLAG_SECURE to every activity that displays protected content.
 */
open class SecureActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            setRecentsScreenshotEnabled(false)
        }
    }
}
