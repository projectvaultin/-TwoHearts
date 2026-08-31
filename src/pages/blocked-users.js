import { requireSession } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { toast, esc, timeAgo } from '../lib/ui.js';

const session = await requireSession();
const uid     = session.user.id;
const list    = document.querySelector('#blockedList');

async function load() {
  list.innerHTML = '<p class="status">Loading…</p>';

  const { data, error } = await supabase
    .from('blocks')
    .select('id, blocked_id, created_at')
    .eq('blocker_id', uid)
    .order('created_at', { ascending: false });

  if (error) { list.innerHTML = `<p class="status">${error.message}</p>`; return; }
  if (!data?.length) {
    list.innerHTML = '<div class="panel" style="text-align:center;padding:40px"><div style="font-size:48px">✅</div><p style="margin-top:12px">No blocked users</p></div>';
    return;
  }

  // Get profiles of blocked users
  const ids = data.map(b => b.blocked_id);
  const { data: profiles } = await supabase
    .from('profiles').select('id,display_name,username,avatar_url').in('id', ids);
  const profileMap = Object.fromEntries((profiles||[]).map(p => [p.id, p]));

  list.innerHTML = '';
  data.forEach(block => {
    const prof = profileMap[block.blocked_id];
    const row  = document.createElement('div');
    row.className = 'connect-card';
    row.innerHTML = `
      <div class="avatar">${(prof?.display_name||'?')[0].toUpperCase()}</div>
      <div style="flex:1">
        <b>${esc(prof?.display_name || 'Unknown user')}</b>
        <small style="display:block;color:var(--muted)">@${esc(prof?.username||'')} · Blocked ${timeAgo(block.created_at)}</small>
      </div>
      <button class="button light" style="font-size:13px;padding:8px 14px" data-id="${block.id}" data-uid="${block.blocked_id}">Unblock</button>`;
    row.querySelector('button').onclick = async () => {
      const name = prof?.display_name || 'this user';
      if (!confirm(`Unblock ${name}? They will be able to message you again.`)) return;
      await supabase.from('blocks').delete().eq('id', block.id);
      toast(`${name} unblocked`, 'success');
      load();
    };
    list.appendChild(row);
  });
}

load();
