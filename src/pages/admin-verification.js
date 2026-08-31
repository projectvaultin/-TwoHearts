import { requireSession } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';

const session = await requireSession();
const uid     = session.user.id;

// Only verification_reviewer or super_admin may access
const { data: adminUser } = await supabase
  .from('admin_users')
  .select('role, is_active')
  .eq('user_id', uid)
  .maybeSingle();

const allowed = ['super_admin', 'verification_reviewer'];
if (!adminUser || !adminUser.is_active || !allowed.includes(adminUser.role)) {
  document.body.innerHTML = '<main class="page"><section class="panel"><h1>Access denied</h1><p>Verification review requires the verification_reviewer role.</p><a href="/app.html">Go home</a></section></main>';
  throw new Error('Not a verification reviewer');
}

document.querySelector('#request').onclick = async () => {
  const s      = document.querySelector('#status');
  const userId = document.querySelector('#userId').value.trim();
  const reason = document.querySelector('#reason').value.trim();

  if (!userId || !reason) { s.textContent = 'User ID and reason are both required.'; return; }

  s.textContent = 'Requesting…';

  const { data, error } = await supabase.functions.invoke('review-verification', {
    body: { user_id: userId, reason }
  });

  s.textContent = error
    ? error.message
    : (data?.ok ? 'Access granted. Check audit log.' : 'Endpoint not yet deployed.');
};
