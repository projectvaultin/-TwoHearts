import { supabase } from '../../lib/supabase.js';
import { toast } from '../../lib/ui.js';

// Show session expired message if redirected here
if (sessionStorage.getItem('sessionExpired')) {
  document.querySelector('#status').textContent = 'Your session expired. Please sign in again.';
  sessionStorage.removeItem('sessionExpired');
}

// If already logged in go straight to app
const { data: { session } } = await supabase.auth.getSession();
if (session) location.href = '/app.html';

// Handle password reset redirect — Supabase puts #access_token in URL
if (location.hash.includes('type=recovery')) {
  location.href = '/reset-password.html' + location.hash;
}

const form = document.querySelector('#loginForm');
const btn  = form.querySelector('button[type=submit]');
let attempts = 0;

form.addEventListener('submit', async e => {
  e.preventDefault();

  // Client-side rate limit — 5 attempts then 30s lockout
  attempts++;
  if (attempts > 5) {
    document.querySelector('#status').textContent = 'Too many attempts. Wait 30 seconds.';
    btn.disabled = true;
    setTimeout(() => { btn.disabled = false; attempts = 0; }, 30000);
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Signing in…';
  document.querySelector('#status').textContent = '';

  const email    = document.querySelector('#email').value.trim();
  const password = document.querySelector('#password').value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    document.querySelector('#status').textContent =
      error.message.includes('Invalid') ? 'Incorrect email or password.' : error.message;
    btn.disabled    = false;
    btn.textContent = 'Sign in';

    // Log security event after 3 failed attempts
    if (attempts >= 3) {
      await supabase.from('security_events').insert({
        event_type: 'failed_login_attempts',
        metadata: { email, attempts, timestamp: new Date().toISOString() }
      }).catch(() => {});
    }
    return;
  }

  // Check if email is confirmed
  if (!data.user.confirmed_at && !data.user.email_confirmed_at) {
    sessionStorage.setItem('pendingEmail', email);
    location.href = `/verify-email.html?email=${encodeURIComponent(email)}`;
    return;
  }

  attempts = 0;
  location.href = '/app.html';
});

// Forgot password
document.querySelector('#forgotPassword').onclick = async e => {
  e.preventDefault();
  const email = document.querySelector('#email').value.trim();
  if (!email) { document.querySelector('#status').textContent = 'Enter your email above first.'; return; }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin + '/reset-password.html'
  });
  document.querySelector('#status').textContent = error
    ? error.message : 'Password reset email sent — check your inbox.';
};
