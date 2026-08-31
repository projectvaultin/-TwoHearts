import { requireSession } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';

const session = await requireSession();
const uid     = session.user.id;
const list    = document.querySelector('#deviceList');

async function load() {
  const { data, error } = await supabase
    .from('user_devices')
    .select('*')
    .eq('user_id', uid)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) { list.innerHTML = `<p class="status">${error.message}</p>`; return; }
  if (!data || data.length === 0) {
    list.innerHTML = '<p class="status">No devices registered yet.</p>';
    return;
  }

  list.innerHTML = '';
  data.forEach(device => {
    const card = document.createElement('article');
    card.className = 'panel';
    const lastSeen = device.last_seen_at
      ? new Date(device.last_seen_at).toLocaleString()
      : 'Never';
    card.innerHTML = `
      <b>${(device.device_name || 'Unknown device').replace(/[<>]/g,'')}</b>
      <p>${(device.platform || '').replace(/[<>]/g,'')}</p>
      <small>Last seen: ${lastSeen}</small>
      <button class="button light" data-id="${device.id}">Revoke</button>`;
    card.querySelector('button').onclick = () => revoke(device.id);
    list.appendChild(card);
  });
}

async function revoke(deviceId) {
  if (!confirm('Revoke this device? It will be signed out.')) return;
  const { error } = await supabase
    .from('user_devices')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', deviceId)
    .eq('user_id', uid);
  if (error) { alert(error.message); return; }
  load();
}

load();
