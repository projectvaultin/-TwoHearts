/**
 * Direct Message page — for connections (non-couple friends)
 * Works the same as couple chat but uses a shared conversation
 * created for any two connected (matched) users.
 */
import { requireSession } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { setWatermark } from '../security/screen-guard.js';

const session = await requireSession();
const uid     = session.user.id;
const params  = new URLSearchParams(location.search);
const withId  = params.get('with');

if (!withId) { location.href = '/connect.html'; throw new Error(); }

const messageList = document.querySelector('#messageList');
const form        = document.querySelector('#composer');
const input       = document.querySelector('#messageInput');

setWatermark(uid);

// ── Verify these two users are actually connected ─────────────────────────────
const { data: match } = await supabase
  .from('matches')
  .select('id')
  .or(`user_a.eq.${uid},user_b.eq.${uid}`)
  .or(`user_a.eq.${withId},user_b.eq.${withId}`)
  .eq('status', 'matched')
  .maybeSingle();

if (!match) {
  messageList.innerHTML = '<p class="status">You are not connected with this person. <a href="/connect.html">Go back</a></p>';
  form.style.display = 'none';
  throw new Error('not connected');
}

// ── Load partner profile ──────────────────────────────────────────────────────
const { data: partner } = await supabase
  .from('profiles')
  .select('display_name, username')
  .eq('id', withId)
  .maybeSingle();

if (partner) {
  document.querySelector('#dmName').textContent   = partner.display_name;
  document.querySelector('#dmAvatar').textContent = (partner.display_name||'?')[0].toUpperCase();
  document.title = `${partner.display_name} — TwoHearts`;
}

// ── Get or create DM conversation ────────────────────────────────────────────
let conversationId = null;

const { data: existing } = await supabase
  .from('conversation_members')
  .select('conversation_id, conversations(id, couple_id, group_id)')
  .eq('user_id', uid);

// Find a 1-to-1 conversation that both users share (no couple_id, no group_id)
let sharedConvId = null;
for (const m of (existing || [])) {
  const conv = m.conversations;
  if (!conv || conv.couple_id || conv.group_id) continue;
  // Check if withId is also in this conversation
  const { data: otherMember } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conv.id)
    .eq('user_id', withId)
    .maybeSingle();
  if (otherMember) { sharedConvId = conv.id; break; }
}

if (!sharedConvId) {
  // Create a new 1-to-1 conversation
  const { data: newConv } = await supabase
    .from('conversations')
    .insert({})
    .select('id')
    .single();
  if (newConv) {
    sharedConvId = newConv.id;
    await supabase.from('conversation_members').insert([
      { conversation_id: sharedConvId, user_id: uid,    role: 'member' },
      { conversation_id: sharedConvId, user_id: withId, role: 'member' }
    ]);
  }
}

conversationId = sharedConvId;

// ── Render a message ──────────────────────────────────────────────────────────
function renderMessage(msg) {
  if (msg.deleted_at) return;
  const div  = document.createElement('div');
  div.className   = `message ${msg.sender_id === uid ? 'mine' : 'theirs'}`;
  div.textContent = msg.ciphertext;
  const t = document.createElement('small');
  t.textContent   = new Date(msg.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  div.appendChild(t);
  messageList.appendChild(div);
  messageList.scrollTop = messageList.scrollHeight;
}

// ── Load history ──────────────────────────────────────────────────────────────
if (conversationId) {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(100);
  (data || []).forEach(renderMessage);

  // Subscribe to new messages
  const sub = supabase
    .channel(`dm:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, p => renderMessage(p.new))
    .subscribe();

  window.addEventListener('beforeunload', () => supabase.removeChannel(sub));
}

// ── Send ──────────────────────────────────────────────────────────────────────
form.addEventListener('submit', async e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !conversationId) return;
  input.value = '';
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id:       uid,
    ciphertext:      text,
    kind:            'text'
  });
});

// ── Block / Report ────────────────────────────────────────────────────────────
document.querySelector('#blockBtn').onclick = async () => {
  if (!confirm(`Block ${partner?.display_name}? They won't be able to message you.`)) return;
  await supabase.from('blocks').insert({ blocker_id: uid, blocked_id: withId });
  await supabase.from('matches').update({ status: 'blocked' })
    .or(`user_a.eq.${uid},user_b.eq.${uid}`)
    .or(`user_a.eq.${withId},user_b.eq.${withId}`);
  alert('Blocked. You will no longer see each other.');
  location.href = '/connect.html';
};

document.querySelector('#reportBtn').onclick = async () => {
  const reason = prompt('Reason for report (e.g. spam, harassment, fake account):');
  if (!reason) return;
  await supabase.from('reports').insert({
    reporter_id:  uid,
    reported_id:  withId,
    reason:       reason.slice(0, 500),
    context_type: 'dm'
  });
  alert('Report submitted. Our team will review it. Thank you.');
};
