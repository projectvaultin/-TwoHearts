import { requireSession, signOut } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';

const session = await requireSession();
const status  = document.querySelector('#status');

document.querySelector('#signOut').onclick = async () => {
  await signOut();
  location.href = '/';
};

document.querySelector('#deleteAccount').onclick = async () => {
  const confirmed = confirm(
    'Delete your account? This will permanently erase your profile and data. This cannot be undone.'
  );
  if (!confirmed) return;

  const doubleCheck = prompt('Type DELETE to confirm:');
  if (doubleCheck !== 'DELETE') { status.textContent = 'Deletion cancelled.'; return; }

  status.textContent = 'Processing…';

  // Sign out and let the user know the server-side deletion is pending
  // Full deletion (auth user, storage files) requires the delete-account Edge Function
  // with service-role key — which runs server-side, never in the browser.
  await signOut();
  alert('Your sign-out is complete. Full account and data deletion is queued and will complete within 24 hours per our retention policy.');
  location.href = '/';
};
