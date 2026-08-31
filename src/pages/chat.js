import { requireSession } from '../lib/auth.js';
import { currentCouple, currentUser } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';
import { toast, esc, timeAgo } from '../lib/ui.js';
import { setWatermark } from '../security/screen-guard.js';
import { startPresence, isOnline } from '../lib/presence.js';

const session     = await requireSession();
const user        = await currentUser();
const uid         = user.id;
const messageList = document.querySelector('#messageList');
const form        = document.querySelector('#composer');
const input       = document.querySelector('#messageInput');
const typingBar   = document.querySelector('#typingBar');
const statusEl    = document.querySelector('#partnerStatus');

setWatermark(uid);

let conversationId = null;
let subscription   = null;
let typingTimer    = null;
let replyingTo     = null;
let partnerId      = null;

// Start presence broadcasting
await startPresence(uid);

// ── Render message ─────────────────────────────────────────────────────────
function renderMessage(msg) {
  if (msg.deleted_at) return;
  const mine = msg.sender_id === uid;
  const div  = document.createElement('div');
  div.className  = `message ${mine ? 'mine' : 'theirs'}`;
  div.dataset.id = msg.id;

  if (msg.reply_to_id) {
    const rp = document.createElement('div');
    rp.className   = 'reply-preview';
    rp.textContent = '↩ Replying to a message';
    div.appendChild(rp);
  }

  const text = document.createElement('span');
  text.textContent = msg.ciphertext;
  div.appendChild(text);

  const meta = document.createElement('small');
  meta.textContent = new Date(msg.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  if (mine) meta.textContent += msg.read_at ? ' ✓✓' : ' ✓';
  div.appendChild(meta);

  div.addEventListener('contextmenu', e => { e.preventDefault(); showMsgMenu(msg, div, mine); });
  let pressTimer;
  div.addEventListener('touchstart', () => { pressTimer = setTimeout(() => showMsgMenu(msg, div, mine), 500); }, {passive:true});
  div.addEventListener('touchend', () => clearTimeout(pressTimer), {passive:true});

  messageList.appendChild(div);
  messageList.scrollTop = messageList.scrollHeight;

  // Mark as read if message is from partner
  if (!mine && !msg.read_at && conversationId) {
    supabase.from('messages').update({ read_at: new Date().toISOString() })
      .eq('id', msg.id).then(() => {});
  }
}

// ── Context menu ───────────────────────────────────────────────────────────
function showMsgMenu(msg, el, mine) {
  document.querySelector('#msgMenu')?.remove();
  const menu = document.createElement('div');
  menu.id    = 'msgMenu';
  menu.style = `position:fixed;background:var(--surface);border:1px solid var(--border);
    border-radius:14px;padding:8px;z-index:500;box-shadow:var(--shadow);min-width:160px;
    top:50%;left:50%;transform:translate(-50%,-50%)`;

  const actions = [
    { label:'↩ Reply', fn: () => {
        replyingTo = msg;
        input.placeholder = `Replying: ${msg.ciphertext.slice(0,40)}…`;
        input.focus();
    }},
    { label:'📋 Copy', fn: () => { navigator.clipboard.writeText(msg.ciphertext); toast('Copied','success'); }},
    ...(mine ? [{ label:'🗑 Delete', fn: async () => {
        await supabase.from('messages').update({deleted_at:new Date().toISOString()}).eq('id',msg.id).eq('sender_id',uid);
        el.style.opacity='.3'; el.querySelector('span').textContent='Message deleted';
        toast('Deleted','info');
    }}] : [
      { label:'🚩 Report', fn: async () => {
          const reason = prompt('Why are you reporting this message?');
          if (!reason) return;
          await supabase.from('reports').insert({reporter_id:uid,reported_id:msg.sender_id,reason,context_type:'message'});
          toast('Reported. Thank you.','success');
      }}
    ])
  ];

  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.style = 'display:block;width:100%;text-align:left;background:none;border:0;padding:10px 14px;border-radius:8px;cursor:pointer;font:inherit;font-size:14px';
    btn.textContent = a.label;
    btn.onmouseenter = () => btn.style.background='var(--bg)';
    btn.onmouseleave = () => btn.style.background='none';
    btn.onclick = () => { a.fn(); menu.remove(); };
    menu.appendChild(btn);
  });

  const close = document.createElement('button');
  close.style = 'display:block;width:100%;text-align:center;background:none;border:0;padding:8px;border-radius:8px;cursor:pointer;font:inherit;font-size:13px;color:var(--muted)';
  close.textContent = 'Cancel';
  close.onclick = () => menu.remove();
  menu.appendChild(close);
  document.body.appendChild(menu);
  document.addEventListener('click', () => menu.remove(), {once:true});
}

// ── Load history ───────────────────────────────────────────────────────────
async function loadHistory(convId) {
  messageList.innerHTML = '<div style="padding:20px;display:flex;flex-direction:column;gap:8px">' +
    Array(5).fill('<div class="skeleton skeleton-line"></div>').join('') + '</div>';

  const { data, error } = await supabase.from('messages').select('*')
    .eq('conversation_id', convId).is('deleted_at', null)
    .order('created_at', {ascending:true}).limit(100);

  if (error) { messageList.innerHTML = `<p class="status" style="padding:20px">${error.message}</p>`; return; }
  messageList.innerHTML = '';
  (data||[]).forEach(renderMessage);
}

// ── Subscribe realtime + typing ────────────────────────────────────────────
function subscribe(convId) {
  if (subscription) supabase.removeChannel(subscription);
  subscription = supabase.channel(`chat:${convId}`)
    .on('postgres_changes', {event:'INSERT',schema:'public',table:'messages',
      filter:`conversation_id=eq.${convId}`}, p => renderMessage(p.new))
    .on('postgres_changes', {event:'UPDATE',schema:'public',table:'messages',
      filter:`conversation_id=eq.${convId}`}, p => {
      const el = messageList.querySelector(`[data-id="${p.new.id}"]`);
      if (el && p.new.read_at && el.querySelector('small')) {
        el.querySelector('small').textContent = el.querySelector('small').textContent.replace('✓','✓✓');
      }
    })
    .on('broadcast', {event:'typing'}, ({payload}) => {
      if (payload.uid === uid) return;
      typingBar.innerHTML = '<div class="typing-bubble"><span></span><span></span><span></span></div> <small style="color:var(--muted)">Partner is typing…</small>';
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => typingBar.innerHTML = '', 2500);
    })
    .subscribe();
}

// ── Send ───────────────────────────────────────────────────────────────────
form.addEventListener('submit', async e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !conversationId) return;
  input.value = ''; input.placeholder = 'Message…';

  // Haptic feedback
  if (navigator.vibrate) navigator.vibrate(10);

  const payload = { conversation_id:conversationId, sender_id:uid, ciphertext:text, kind:'text' };
  if (replyingTo) { payload.reply_to_id = replyingTo.id; replyingTo = null; }

  const { error } = await supabase.from('messages').insert(payload);
  if (error) toast(error.message, 'error');
});

// Broadcast typing
input.addEventListener('input', () => {
  if (!conversationId) return;
  supabase.channel(`chat:${conversationId}`)
    .send({type:'broadcast', event:'typing', payload:{uid}});
});

// ── Presence listener ──────────────────────────────────────────────────────
window.addEventListener('presenceSync', () => {
  if (!partnerId || !statusEl) return;
  const online = isOnline(partnerId);
  statusEl.innerHTML = online
    ? '<span class="online-dot"></span>Online'
    : '<span class="online-dot offline-dot"></span>Offline';
});

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  const couple = await currentCouple();
  if (!couple) {
    messageList.innerHTML = '<p class="status" style="padding:20px;text-align:center">Pair with your partner first to start chatting.<br><br><a href="/couple.html" class="button accent">Couple settings →</a></p>';
    return;
  }

  partnerId = couple.partner_a === uid ? couple.partner_b : couple.partner_a;

  if (partnerId) {
    const { data: p } = await supabase.from('profiles').select('display_name').eq('id', partnerId).maybeSingle();
    if (p) {
      document.querySelector('#partnerName').textContent = p.display_name;
      document.querySelector('#partnerAvatar').textContent = p.display_name[0].toUpperCase();
    }
  }

  let { data: conv, error } = await supabase.from('conversations').select('id').eq('couple_id', couple.id).maybeSingle();
  if (!conv && !error) {
    const res = await supabase.from('conversations').insert({couple_id:couple.id}).select('id').single();
    conv = res.data; error = res.error;
  }
  if (error || !conv) { messageList.innerHTML = '<p class="status" style="padding:20px">Could not load conversation.</p>'; return; }

  conversationId = conv.id;
  await loadHistory(conversationId);
  subscribe(conversationId);
}

window.addEventListener('beforeunload', () => { if (subscription) supabase.removeChannel(subscription); });
init();
