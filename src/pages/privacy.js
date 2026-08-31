import { requireSession } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';

const session = await requireSession();
const uid     = session.user.id;
const status  = document.querySelector('#status');

// Load existing settings
const { data } = await supabase
  .from('privacy_settings')
  .select('*')
  .eq('user_id', uid)
  .maybeSingle();

if (data) {
  document.querySelector('#lastSeen').checked    = data.show_last_seen;
  document.querySelector('#online').checked      = data.show_online_status;
  document.querySelector('#readReceipts').checked = data.read_receipts;
  document.querySelector('#typing').checked      = data.typing_indicator;
  document.querySelector('#previews').checked    = data.message_preview_notifications;
}

document.querySelector('#savePrivacy').onclick = async () => {
  status.textContent = 'Saving…';

  const { error } = await supabase.from('privacy_settings').upsert({
    user_id:                      uid,
    show_last_seen:               document.querySelector('#lastSeen').checked,
    show_online_status:           document.querySelector('#online').checked,
    read_receipts:                document.querySelector('#readReceipts').checked,
    typing_indicator:             document.querySelector('#typing').checked,
    message_preview_notifications: document.querySelector('#previews').checked,
    updated_at:                   new Date().toISOString()
  }, { onConflict: 'user_id' });

  status.textContent = error ? error.message : 'Privacy settings saved ✓';
};
