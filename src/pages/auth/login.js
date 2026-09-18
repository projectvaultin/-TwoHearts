import { supabase, supabaseConfigured } from '../../lib/supabase.js';

const status = document.querySelector('#status');
const form = document.querySelector('#loginForm');
const btn = form.querySelector('button[type=submit]');
const forgot = document.querySelector('#forgotPassword');

if (!supabaseConfigured || !supabase) {
  status.textContent = 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the deployment environment and rebuild.';
  btn.disabled = true;
  forgot.setAttribute('aria-disabled', 'true');
} else {
  if (sessionStorage.getItem('sessionExpired')) {
    status.textContent = 'Your session expired. Please sign in again.';
    sessionStorage.removeItem('sessionExpired');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    location.href = '/app.html';
  }

  if (location.hash.includes('type=recovery')) {
    location.href = '/reset-password.html' + location.hash;
  }

  let attempts = 0;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (btn.disabled) return;

    attempts++;
    if (attempts > 5) {
      status.textContent = 'Too many attempts. Wait 30 seconds.';
      btn.disabled = true;
      setTimeout(() => { btn.disabled = false; attempts = 0; }, 30000);
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Signing in…';
    status.textContent = '';

    const email = document.querySelector('#email').value.trim();
    const password = document.querySelector('#password').value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      status.textContent = /invalid|credentials/i.test(error.message) ? 'Incorrect email or password.' : error.message;
      btn.disabled = false;
      btn.textContent = 'Sign in';
      return;
    }

    if (!data.user?.email_confirmed_at) {
      sessionStorage.setItem('pendingEmail', email);
      location.href = `/verify-email.html?email=${encodeURIComponent(email)}`;
      return;
    }

    attempts = 0;
    location.href = '/app.html';
  });

  forgot.addEventListener('click', async e => {
    e.preventDefault();
    const email = document.querySelector('#email').value.trim();
    if (!email) { status.textContent = 'Enter your email above first.'; return; }
    forgot.style.pointerEvents = 'none';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset-password.html`
    });
    forgot.style.pointerEvents = '';
    status.textContent = error ? error.message : 'Password reset email sent — check your inbox.';
  });
}
