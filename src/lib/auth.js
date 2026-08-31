import { supabase } from './supabase.js';

export async function requireSession() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    location.href = '/login.html';
    throw new Error('No session');
  }

  // Token expiry check — refresh if within 5 minutes of expiry
  const expiresAt  = session.expires_at * 1000;
  const fiveMinutes = 5 * 60 * 1000;

  if (Date.now() > expiresAt - fiveMinutes) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) {
      sessionStorage.setItem('sessionExpired', '1');
      location.href = '/login.html';
      throw new Error('Session expired');
    }
    return refreshed.session;
  }

  return session;
}

export async function signOut() {
  await supabase.auth.signOut();
  sessionStorage.clear();
  location.href = '/';
}

export async function currentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
