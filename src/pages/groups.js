import { requireSession } from '../lib/auth.js';
import { currentUser } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';

const session  = await requireSession();
const user     = await currentUser();
const uid      = user.id;
const status   = document.querySelector('#status');
const groupsEl = document.querySelector('#groups');

// Load groups the user is a member of
async function load() {
  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id, conversations(id, groups(id, name, description))')
    .eq('user_id', uid);

  if (error) { groupsEl.innerHTML = `<p class="status">${error.message}</p>`; return; }
  groupsEl.innerHTML = '';

  const groups = (data || [])
    .map(d => d.conversations?.groups)
    .filter(Boolean);

  if (groups.length === 0) {
    groupsEl.innerHTML = '<p class="status">You are not in any groups yet.</p>';
    return;
  }

  groups.forEach(g => {
    const card = document.createElement('article');
    card.className = 'panel';
    card.innerHTML = `<b>${(g.name||'').replace(/[<>]/g,'')}</b><p>${(g.description||'').replace(/[<>]/g,'')}</p>`;
    groupsEl.appendChild(card);
  });
}

// Create a group
document.querySelector('#groupForm').onsubmit = async e => {
  e.preventDefault();
  status.textContent = 'Creating…';

  const name    = document.querySelector('#groupName').value.trim();
  const members = document.querySelector('#groupMembers').value
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  // Create group record
  const { data: group, error: gErr } = await supabase
    .from('groups')
    .insert({ name, owner_id: uid, member_count: 1 + members.length })
    .select('id')
    .single();

  if (gErr) { status.textContent = gErr.message; return; }

  // Create a conversation for this group
  const { data: conv, error: cErr } = await supabase
    .from('conversations')
    .insert({ group_id: group.id })
    .select('id')
    .single();

  if (cErr) { status.textContent = cErr.message; return; }

  // Add owner as member
  await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: uid, role: 'owner' });

  // Look up invited users by username and add them
  if (members.length > 0) {
    const { data: invitees } = await supabase
      .from('profiles')
      .select('id')
      .in('username', members);

    if (invitees?.length) {
      await supabase.from('conversation_members').insert(
        invitees.map(p => ({ conversation_id: conv.id, user_id: p.id, role: 'member' }))
      );
    }
  }

  status.textContent = `Group "${name}" created ✓`;
  document.querySelector('#groupForm').reset();
  load();
};

load();
