import { requireSession } from '../lib/auth.js';
import { currentCouple, currentUser } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';
import { toast, esc } from '../lib/ui.js';

const session = await requireSession();
const user    = await currentUser();
const uid     = user.id;
const statusEl = document.querySelector('#pairStatus');

function countDays(dateStr) {
  if (!dateStr) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr + 'T00:00:00')) / 86400000));
}

async function load() {
  const couple = await currentCouple();
  if (!couple) return;

  document.querySelector('#coupleTitle').textContent = couple.nickname || 'Your couple space';
  document.querySelector('#coupleNickname').value    = couple.nickname || '';

  if (couple.relationship_date) {
    document.querySelector('#relationshipDate').value = couple.relationship_date;
    document.querySelector('#days').textContent       = countDays(couple.relationship_date);
  }

  // Couple photo
  if (couple.avatar_url) {
    document.querySelector('#couplePhotoPreview').innerHTML =
      `<img src="${couple.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  }

  // Partner info
  if (couple.partner_b) {
    const partnerId = couple.partner_a === uid ? couple.partner_b : couple.partner_a;
    const { data: partner } = await supabase
      .from('profiles').select('display_name,username,avatar_url').eq('id', partnerId).maybeSingle();
    if (partner) {
      document.querySelector('#partnerDisplay').innerHTML = `
        <div class="connect-card">
          <div class="avatar">${(partner.display_name||'?')[0].toUpperCase()}</div>
          <div>
            <b>${esc(partner.display_name)}</b>
            <small style="display:block;color:var(--muted)">@${esc(partner.username||'')}</small>
          </div>
          <span class="verified-badge">✓ Partner</span>
        </div>`;
    }
    document.querySelector('#pairSection').style.display   = 'none';
    document.querySelector('#coupleSection').style.display = 'block';
    statusEl.textContent = '❤️ You are connected';
  } else {
    document.querySelector('#pairSection').style.display   = 'block';
    document.querySelector('#coupleSection').style.display = 'none';
  }
}

// ── Create pairing code ────────────────────────────────────────────────────
document.querySelector('#createPair').onclick = async () => {
  statusEl.textContent = 'Creating…';
  const code = Math.random().toString(36).slice(2,8).toUpperCase();
  const expiresAt = new Date(Date.now() + 24*60*60*1000).toISOString();
  const encoder   = new TextEncoder();
  const hashBuf   = await crypto.subtle.digest('SHA-256', encoder.encode(code));
  const hashHex   = [...new Uint8Array(hashBuf)].map(b=>b.toString(16).padStart(2,'0')).join('');

  const { error } = await supabase.from('couples').upsert({
    partner_a: uid, partner_b: null,
    pairing_code_hash: hashHex, pairing_expires_at: expiresAt
  }, { onConflict: 'partner_a' });

  if (error) { statusEl.textContent = error.message; return; }

  const { data: couple } = await supabase.from('couples').select('id').eq('partner_a', uid).maybeSingle();
  if (couple) {
    await supabase.from('couple_members').upsert({ couple_id:couple.id, user_id:uid }, { onConflict:'user_id' });
  }

  document.querySelector('#codeDisplay').textContent = code;
  document.querySelector('#codeBox').style.display   = 'block';
  statusEl.textContent = 'Code valid for 24 hours — share it only with your partner.';

  // Copy button
  document.querySelector('#copyCode').onclick = () => {
    navigator.clipboard.writeText(code);
    toast('Code copied!', 'success');
  };

  // Share button
  document.querySelector('#shareCode').onclick = () => {
    const msg = `Join my private TwoHearts space! Code: ${code}\nApp: ${location.origin}/couple.html`;
    if (navigator.share) {
      navigator.share({ title:'Join my TwoHearts space', text: msg });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
    }
  };
};

// ── Join with code ─────────────────────────────────────────────────────────
document.querySelector('#joinPair').onclick = async () => {
  const code = document.querySelector('#pairCode').value.trim().toUpperCase();
  if (!code) { statusEl.textContent = 'Enter the code your partner shared.'; return; }

  statusEl.textContent = 'Joining…';
  const encoder = new TextEncoder();
  const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(code));
  const hashHex = [...new Uint8Array(hashBuf)].map(b=>b.toString(16).padStart(2,'0')).join('');

  const { data: couple, error } = await supabase
    .from('couples').select('id,partner_a,pairing_expires_at')
    .eq('pairing_code_hash', hashHex).is('partner_b', null).maybeSingle();

  if (error || !couple)         { statusEl.textContent = 'Invalid or expired code.'; return; }
  if (couple.partner_a === uid) { statusEl.textContent = 'You cannot pair with yourself.'; return; }
  if (new Date(couple.pairing_expires_at) < new Date()) {
    statusEl.textContent = 'Code expired. Ask your partner to generate a new one.'; return;
  }

  const { error: updErr } = await supabase.from('couples')
    .update({ partner_b: uid, pairing_code_hash: null, pairing_expires_at: null })
    .eq('id', couple.id);

  if (updErr) { statusEl.textContent = updErr.message; return; }

  await supabase.from('couple_members').upsert([
    { couple_id: couple.id, user_id: couple.partner_a },
    { couple_id: couple.id, user_id: uid }
  ], { onConflict: 'user_id' });

  toast('❤️ Paired successfully!', 'success');
  statusEl.textContent = '❤️ Paired! Refreshing…';
  setTimeout(() => location.reload(), 1200);
};

// ── Save couple details ────────────────────────────────────────────────────
document.querySelector('#saveCouple').onclick = async () => {
  const couple = await currentCouple();
  if (!couple) { toast('No couple space yet', 'error'); return; }

  const nickname = document.querySelector('#coupleNickname').value.trim();
  const dateVal  = document.querySelector('#relationshipDate').value;

  const { error } = await supabase.from('couples').update({
    nickname:          nickname || null,
    relationship_date: dateVal  || null,
    updated_at:        new Date().toISOString()
  }).eq('id', couple.id);

  if (error) { toast(error.message, 'error'); return; }
  document.querySelector('#coupleTitle').textContent = nickname || 'Your couple space';
  document.querySelector('#days').textContent = countDays(dateVal);
  toast('Saved ✓', 'success');
};

// ── Upload couple photo ────────────────────────────────────────────────────
document.querySelector('#couplePhotoInput').addEventListener('change', async e => {
  const file   = e.target.files[0];
  const couple = await currentCouple();
  if (!file || !couple) return;

  if (file.size > 5*1024*1024) { toast('Max 5MB','error'); return; }
  toast('Uploading…', 'info');

  const path = `couple-media/${couple.id}/avatar.${file.name.split('.').pop()}`;
  const { error } = await supabase.storage.from('couple-media').upload(path, file, { upsert:true });
  if (error) { toast(error.message, 'error'); return; }

  const { data } = supabase.storage.from('couple-media').getPublicUrl(path);
  await supabase.from('couples').update({ avatar_url: data.publicUrl }).eq('id', couple.id);
  document.querySelector('#couplePhotoPreview').innerHTML =
    `<img src="${data.publicUrl}?t=${Date.now()}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  toast('Couple photo updated ✓', 'success');
});

// ── Leave couple space ─────────────────────────────────────────────────────
document.querySelector('#leaveCouple').onclick = async () => {
  const couple = await currentCouple();
  if (!couple) return;

  const confirmed = confirm(
    'Leave your couple space? This will disconnect you and your partner permanently. All shared data (messages, memories, journal) will remain but you will lose access to each other\'s private space.\n\nType LEAVE in the next prompt to confirm.'
  );
  if (!confirmed) return;

  const check = prompt('Type LEAVE to confirm:');
  if (check !== 'LEAVE') { toast('Cancelled', 'info'); return; }

  // Remove user from couple
  const isPartnerA = couple.partner_a === uid;
  const updateData = isPartnerA
    ? { partner_a: couple.partner_b, partner_b: null }
    : { partner_b: null };

  await supabase.from('couples').update(updateData).eq('id', couple.id);
  await supabase.from('couple_members').delete().eq('couple_id', couple.id).eq('user_id', uid);

  toast('You have left the couple space.', 'info');
  setTimeout(() => location.href = '/app.html', 1500);
};

document.querySelector('#relationshipDate').addEventListener('change', e => {
  document.querySelector('#days').textContent = countDays(e.target.value);
});

load();
