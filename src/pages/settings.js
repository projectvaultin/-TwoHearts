import { requireSession } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { toast, toggleDarkMode } from '../lib/ui.js';

const session = await requireSession();
const uid     = session.user.id;

// Dark mode toggle
document.querySelector('#themeToggle').onclick = () => {
  toggleDarkMode();
  const isDark = document.documentElement.dataset.theme === 'dark';
  document.querySelector('#themeToggle').textContent = isDark ? '☀️' : '🌙';
};

// Load profile name for header
const { data: profile } = await supabase
  .from('profiles').select('display_name,username,avatar_url').eq('id',uid).maybeSingle();
if (profile) {
  document.querySelector('#settingsName').textContent     = profile.display_name || '';
  document.querySelector('#settingsUsername').textContent = '@' + (profile.username || '');
  if (profile.avatar_url) {
    document.querySelector('#settingsAvatar').innerHTML =
      `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover">`;
  } else {
    document.querySelector('#settingsAvatar').textContent = (profile.display_name||'?')[0].toUpperCase();
  }
}

// Load privacy settings
const { data: priv } = await supabase
  .from('privacy_settings').select('*').eq('user_id',uid).maybeSingle();
if (priv) {
  document.querySelector('#lastSeen').checked    = priv.show_last_seen    ?? true;
  document.querySelector('#online').checked      = priv.show_online_status ?? true;
  document.querySelector('#readReceipts').checked = priv.read_receipts      ?? true;
  document.querySelector('#typing').checked      = priv.typing_indicator   ?? true;
  document.querySelector('#previews').checked    = priv.message_preview_notifications ?? false;
}

// Auto-save privacy toggles
['lastSeen','online','readReceipts','typing','previews'].forEach(id => {
  document.querySelector('#'+id).addEventListener('change', savePrivacy);
});

async function savePrivacy() {
  const { error } = await supabase.from('privacy_settings').upsert({
    user_id:                      uid,
    show_last_seen:               document.querySelector('#lastSeen').checked,
    show_online_status:           document.querySelector('#online').checked,
    read_receipts:                document.querySelector('#readReceipts').checked,
    typing_indicator:             document.querySelector('#typing').checked,
    message_preview_notifications: document.querySelector('#previews').checked,
    updated_at:                   new Date().toISOString()
  },{onConflict:'user_id'});
  document.querySelector('#privacyStatus').textContent = error ? error.message : 'Saved ✓';
  setTimeout(() => { document.querySelector('#privacyStatus').textContent = ''; }, 2000);
}

// Load notification prefs
const { data: notif } = await supabase
  .from('notification_preferences').select('*').eq('user_id',uid).maybeSingle();
if (notif) {
  document.querySelector('#notifMessages').checked  = notif.messages       ?? true;
  document.querySelector('#notifCalls').checked     = notif.calls          ?? true;
  document.querySelector('#notifSurprises').checked = notif.surprises      ?? true;
  document.querySelector('#notifDates').checked     = notif.important_dates ?? true;
}

document.querySelector('#saveNotifs').onclick = async () => {
  const { error } = await supabase.from('notification_preferences').upsert({
    user_id:         uid,
    messages:        document.querySelector('#notifMessages').checked,
    calls:           document.querySelector('#notifCalls').checked,
    surprises:       document.querySelector('#notifSurprises').checked,
    important_dates: document.querySelector('#notifDates').checked
  },{onConflict:'user_id'});
  toast(error ? error.message : 'Notification settings saved ✓', error ? 'error' : 'success');
};
