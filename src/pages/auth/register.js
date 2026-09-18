import { supabase, supabaseConfigured } from '../../lib/supabase.js';

const form = document.querySelector('#registerForm');
const status = document.querySelector('#status');
const btn = form.querySelector('button[type=submit]');

if (!supabaseConfigured || !supabase) {
  status.textContent = 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the deployment environment and rebuild.';
  btn.disabled = true;
} else {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Creating account…';
    status.textContent = '';

    const email = document.querySelector('#email').value.trim();
    const password = document.querySelector('#password').value;
    const displayName = document.querySelector('#displayName').value.trim();
    const username = document.querySelector('#username').value.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      status.textContent = 'Username: 3-30 chars, letters/numbers/underscore only.';
      btn.disabled = false; btn.textContent = 'Create account'; return;
    }

    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { display_name: displayName, username } }
    });

    if (error) {
      status.textContent = error.message;
      btn.disabled = false; btn.textContent = 'Create account'; return;
    }

    if (data.user) {
      const profile = await supabase.from('profiles').upsert({
        id: data.user.id, username, display_name: displayName,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (profile.error) console.warn('Profile creation deferred:', profile.error.message);

      await supabase.from('privacy_settings').upsert({ user_id: data.user.id }, { onConflict: 'user_id' });
      await supabase.from('notification_preferences').upsert({ user_id: data.user.id }, { onConflict: 'user_id' });
    }

    if (data.session) {
      location.href = '/onboarding.html';
    } else {
      sessionStorage.setItem('pendingEmail', email);
      location.href = `/verify-email.html?email=${encodeURIComponent(email)}`;
    }
  });
}
