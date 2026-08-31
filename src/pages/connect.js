import { requireSession } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import {
  searchUser, sendConnectionRequest,
  acceptConnection, getPendingRequests,
  getConnections, getShareableLink
} from '../pages/discover.js';

const session = await requireSession();
const uid     = session.user.id;

// ── My shareable link ─────────────────────────────────────────────────────────
const linkInput = document.querySelector('#myLink');
const link      = await getShareableLink();
if (link) linkInput.value = link;

document.querySelector('#copyLink').onclick = () => {
  navigator.clipboard.writeText(linkInput.value);
  document.querySelector('#copyLink').textContent = 'Copied ✓';
  setTimeout(() => { document.querySelector('#copyLink').textContent = 'Copy'; }, 2000);
};

document.querySelector('#shareLink').onclick = () => {
  if (navigator.share) {
    navigator.share({ title: 'Connect with me on TwoHearts', url: linkInput.value });
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent('Connect with me on TwoHearts: ' + linkInput.value)}`);
  }
};

// ── QR code (using free qrcode.js from CDN — no API key needed) ──────────────
const qrWrap = document.querySelector('#qrWrap');
if (link) {
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  script.onload = () => {
    new QRCode(qrWrap, { text: link, width: 180, height: 180,
      colorDark: '#171923', colorLight: '#ffffff' });
  };
  document.head.appendChild(script);
}

// ── If opened via shared link ─────────────────────────────────────────────────
const params   = new URLSearchParams(location.search);
const autoUser = params.get('u');
if (autoUser) {
  document.querySelector('#searchInput').value = autoUser;
  doSearch();
}

// ── Search ────────────────────────────────────────────────────────────────────
document.querySelector('#searchBtn').onclick = doSearch;
document.querySelector('#searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

async function doSearch() {
  const q      = document.querySelector('#searchInput').value.trim();
  const result = document.querySelector('#searchResult');
  result.innerHTML = '<p class="status">Searching…</p>';

  const profile = await searchUser(q);
  if (!profile) {
    result.innerHTML = '<p class="status">No user found, or this user is not available.</p>';
    return;
  }

  result.innerHTML = '';
  const card = document.createElement('article');
  card.className = 'panel';
  card.style = 'display:flex;align-items:center;gap:16px';
  card.innerHTML = `
    <div class="avatar">${(profile.display_name||'?')[0].toUpperCase()}</div>
    <div style="flex:1">
      <b>${esc(profile.display_name)}</b>
      <small style="display:block;color:#777">@${esc(profile.username)}
        ${profile.verified ? ' ✓ Verified' : ''}</small>
      <p style="margin:4px 0;font-size:14px;color:#555">${esc(profile.about||'')}</p>
    </div>
    <button class="button dark" id="sendReq">Connect</button>`;
  result.appendChild(card);

  card.querySelector('#sendReq').onclick = async () => {
    const msg   = prompt('Add a short message (optional):') || '';
    const { error } = await sendConnectionRequest(profile.id, msg);
    if (error) {
      alert(error.message.includes('duplicate') ? 'You already sent a request to this person.' : error.message);
    } else {
      card.querySelector('#sendReq').textContent = 'Request sent ✓';
      card.querySelector('#sendReq').disabled = true;
    }
  };
}

// ── Incoming requests ─────────────────────────────────────────────────────────
async function loadRequests() {
  const list    = document.querySelector('#requestList');
  const { data } = await getPendingRequests();

  if (!data.length) { list.innerHTML = '<p class="status">No pending requests.</p>'; return; }
  list.innerHTML = '';

  data.forEach(req => {
    const card  = document.createElement('div');
    card.style  = 'display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #eee';
    const prof  = req.profiles;
    card.innerHTML = `
      <div class="avatar">${(prof?.display_name||'?')[0].toUpperCase()}</div>
      <div style="flex:1">
        <b>${esc(prof?.display_name||'Unknown')}</b>
        <small style="display:block;color:#777">@${esc(prof?.username||'')}</small>
        ${req.message ? `<p style="font-size:13px;color:#555;margin:4px 0">"${esc(req.message)}"</p>` : ''}
      </div>
      <button class="button dark"  data-id="${req.id}" data-action="accept">Accept</button>
      <button class="button light" data-id="${req.id}" data-action="decline">Decline</button>`;
    list.appendChild(card);
  });

  list.querySelectorAll('button').forEach(btn => {
    btn.onclick = async () => {
      const id     = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'accept') {
        const { error } = await acceptConnection(id);
        if (error) { alert(error.message); return; }
      } else {
        await supabase.from('matches').update({ status: 'declined' }).eq('id', id);
      }
      loadRequests();
      loadConnections();
    };
  });
}

// ── My connections ────────────────────────────────────────────────────────────
async function loadConnections() {
  const list        = document.querySelector('#connectionList');
  const { data }    = await getConnections();

  if (!data.length) { list.innerHTML = '<p class="status">No connections yet. Share your link above to get started.</p>'; return; }
  list.innerHTML = '';

  data.forEach(conn => {
    if (!conn.partner) return;
    const card  = document.createElement('div');
    card.style  = 'display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #eee';
    card.innerHTML = `
      <div class="avatar">${(conn.partner.display_name||'?')[0].toUpperCase()}</div>
      <div style="flex:1">
        <b>${esc(conn.partner.display_name)}</b>
        <small style="display:block;color:#777">@${esc(conn.partner.username)}</small>
      </div>
      <a class="button dark" href="/dm.html?with=${conn.partner.id}">Message</a>`;
    list.appendChild(card);
  });
}

function esc(str) {
  return (str||'').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
}

loadRequests();
loadConnections();
