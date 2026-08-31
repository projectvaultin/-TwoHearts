import { supabase } from '../../lib/supabase.js';
import { toast } from '../../lib/ui.js';

const form   = document.querySelector('#registerForm');
const status = document.querySelector('#status');
const btn    = document.querySelector('button[type=submit]');

form.addEventListener('submit', async e => {
  e.preventDefault();
  btn.disabled    = true;
  btn.textContent = 'Creating account…';
  status.textContent = '';

  const email       = document.querySelector('#email').value.trim();
  const password    = document.querySelector('#password').value;
  const displayName = document.querySelector('#displayName').value.trim();
  const username    = document.querySelector('#username').value.trim().toLowerCase();

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    status.textContent = 'Username: 3-30 chars, letters/numbers/underscore only.';
    btn.disabled = false; btn.textContent = 'Create account'; return;
  }

  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { display_name: displayName, username } }
  });

  if (error) {
    status.textContent = error.message;
    btn.disabled = false; btn.textContent = 'Create account'; return;
  }

  // Create profile row immediately
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id, username, display_name: displayName,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    await supabase.from('privacy_settings').upsert(
      { user_id: data.user.id }, { onConflict: 'user_id' });

    await supabase.from('notification_preferences').upsert(
      { user_id: data.user.id }, { onConflict: 'user_id' });
  }

  if (data.session) {
    // Email confirmation not required — go straight to onboarding
    location.href = '/onboarding.html';
  } else {
    // Email confirmation required
    sessionStorage.setItem('pendingEmail', email);
    location.href = `/verify-email.html?email=${encodeURIComponent(email)}`;
  }
});
