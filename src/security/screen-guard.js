/**
 * TwoHearts Screen Guard
 *
 * What this CAN do (in a browser):
 *   - Detect when the window loses focus (tab switch, screen-share preview)
 *     and blur sensitive content immediately
 *   - Block text selection on protected screens
 *   - Add invisible watermarks to content (so screenshots can be traced)
 *   - Detect the Screen Capture API being used (Chrome 94+)
 *   - Log security events to Supabase when capture is detected
 *   - Show a warning overlay
 *
 * What NO browser code can do:
 *   - Block the OS screenshot shortcut (Print Screen, Cmd+Shift+3)
 *   - Block another phone photographing the screen
 *   - Block a rooted Android or jailbroken iOS device
 *
 * For the strongest protection: the Android wrapper uses FLAG_SECURE
 * (see android/app/src/main/java/com/twohearts/security/SecureActivity.kt)
 */

import { supabase } from '../lib/supabase.js';

const PROTECTED_PAGES = [
  '/chat.html', '/vault.html', '/verification.html',
  '/admin.html', '/admin-verification.html', '/calls.html',
  '/couple.html', '/groups.html'
];

const page = location.pathname;
const isProtected = PROTECTED_PAGES.some(p => page.endsWith(p));

let overlay = null;

// -- Log security event to Supabase ----------------------------------------
async function logCaptureEvent(eventType) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('security_events').insert({
      user_id:    session.user.id,
      event_type: eventType,
      metadata: {
        page:      location.pathname,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent.slice(0, 200)
      }
    });
  } catch (_) {
    // Never crash the page over a logging failure
  }
}

// Only activate on protected pages
if (isProtected) {

  // -- Warning overlay --------------------------------------------------------
  overlay = document.createElement('div');
  overlay.className = 'capture-warning';
  overlay.innerHTML = `
    <h2>Protected screen</h2>
    <p>This screen contains private content.<br>
       Screenshots and screen recording are not permitted.</p>
    <button class="button dark" id="guardDismiss">I understand</button>`;
  document.body.appendChild(overlay);
  document.querySelector('#guardDismiss').onclick = () => overlay.classList.remove('active');

  // -- Mark sensitive body areas -----------------------------------------------
  document.body.classList.add('secure-screen');

  // -- Focus-blur: blur content when window is not in focus -------------------
  let blurTimer = null;
  window.addEventListener('blur', () => {
    blurTimer = setTimeout(() => {
      document.body.classList.add('focus-blur');
    }, 800);
  });
  window.addEventListener('focus', () => {
    clearTimeout(blurTimer);
    document.body.classList.remove('focus-blur');
  });

  // -- Screen Capture API detection (Chrome 94+) -------------------------------
  const originalGetDisplayMedia = navigator.mediaDevices?.getDisplayMedia?.bind(navigator.mediaDevices);
  if (originalGetDisplayMedia) {
    navigator.mediaDevices.getDisplayMedia = async function (...args) {
      logCaptureEvent('screen_share_attempt');
      overlay.classList.add('active');
      return originalGetDisplayMedia(...args);
    };
  }

  // -- Keyboard shortcut detection ---------------------------------------------
  document.addEventListener('keydown', e => {
    const isScreenshot =
      (e.key === 'PrintScreen') ||
      (e.metaKey && e.shiftKey && ['3','4','5','6'].includes(e.key)) ||
      (e.ctrlKey && e.shiftKey && e.key === 'S');

    if (isScreenshot) {
      logCaptureEvent('screenshot_key');
      overlay.classList.add('active');
      document.body.style.visibility = 'hidden';
      setTimeout(() => { document.body.style.visibility = ''; }, 400);
    }
  });

  // -- Visibility API - page hidden --------------------------------------------
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      document.body.classList.add('focus-blur');
    } else {
      document.body.classList.remove('focus-blur');
    }
  });
}

export function initScreenGuard() {
  // Already initialised above on import (if this is a protected page) --
  // exposed for manual trigger if needed.
}

// -- Invisible watermark ------------------------------------------------------
export async function setWatermark(userId) {
  const wrap = document.querySelector('.message-list') ||
               document.querySelector('#adminMessages');
  if (!wrap) return;
  wrap.classList.add('watermark-wrap');
  wrap.dataset.watermark = userId ? userId.slice(0, 8).toUpperCase() : '';
}
