import { requireSession } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { toast } from '../lib/ui.js';

const session = await requireSession();
const uid     = session.user.id;

// ── Load profile ──────────────────────────────────────────────────────────────
const { data: profile } = await supabase
  .from('profiles')
  .select('display_name,username,about,avatar_url,gender,location,birth_date')
  .eq('id', uid).maybeSingle();

if (profile) {
  document.querySelector('#displayName').value = profile.display_name || '';
  document.querySelector('#username').value    = profile.username     || '';
  document.querySelector('#about').value       = profile.about        || '';
  document.querySelector('#location').value    = profile.location     || '';
  if (profile.avatar_url) {
    document.querySelector('#avatarPreview').innerHTML =
      `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover">`;
  } else {
    document.querySelector('#avatarPreview').textContent =
      (profile.display_name||'?')[0].toUpperCase();
  }
}

// ── Completeness score ────────────────────────────────────────────────────────
function updateScore() {
  const fields = [
    document.querySelector('#displayName').value,
    document.querySelector('#username').value,
    document.querySelector('#about').value,
    document.querySelector('#location').value,
    profile?.avatar_url
  ];
  const filled   = fields.filter(Boolean).length;
  const pct      = Math.round((filled / fields.length) * 100);
  document.querySelector('#scoreLabel').textContent = `${pct}% complete`;
  document.querySelector('#scoreFill').style.width  = `${pct}%`;

  let msg = pct < 40 ? 'Add more info to stand out 💡' :
            pct < 80 ? 'Looking good! Add a few more details 👍' :
            'Profile complete! ✓';
  document.querySelector('#scoreMsg').textContent = msg;
}

['#displayName','#username','#about','#location'].forEach(sel => {
  document.querySelector(sel).addEventListener('input', updateScore);
});
updateScore();

// ── Avatar upload ─────────────────────────────────────────────────────────────
document.querySelector('#avatarInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Max 5MB for avatar','error'); return; }

  toast('Uploading avatar…','info');
  const ext  = file.name.split('.').pop();
  const path = `avatars/${uid}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('avatars').upload(path, file, {upsert:true, contentType:file.type});
  if (upErr) { toast(upErr.message,'error'); return; }

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  const avatarUrl = urlData.publicUrl + '?t=' + Date.now();

  await supabase.from('profiles').update({avatar_url:avatarUrl,updated_at:new Date().toISOString()}).eq('id',uid);
  document.querySelector('#avatarPreview').innerHTML =
    `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover">`;
  toast('Avatar updated ✓','success');
  updateScore();
});

// ── Save profile ──────────────────────────────────────────────────────────────
document.querySelector('#profileForm').onsubmit = async e => {
  e.preventDefault();
  const displayName = document.querySelector('#displayName').value.trim();
  const username    = document.querySelector('#username').value.trim().toLowerCase();
  const about       = document.querySelector('#about').value.trim();
  const location    = document.querySelector('#location').value.trim();

  if (!displayName || !username) { toast('Name and username are required','error'); return; }
  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    toast('Username: 3-30 chars, letters/numbers/underscore only','error'); return;
  }

  const { error } = await supabase.from('profiles').upsert({
    id:uid, display_name:displayName, username, about, location,
    updated_at:new Date().toISOString()
  },{onConflict:'id'});

  if (error) {
    toast(error.message.includes('unique') ? 'Username already taken' : error.message,'error');
  } else {
    toast('Profile saved ✓','success');
    updateScore();
  }
};

// ── Verification status ───────────────────────────────────────────────────────
const { data: verif } = await supabase
  .from('identity_verifications').select('status,updated_at').eq('user_id',uid).maybeSingle();
const verifEl = document.querySelector('#verifStatus');
if (verifEl) {
  if (verif?.status === 'approved') {
    verifEl.innerHTML = '<span class="verified-badge">✓ Verified</span>';
  } else if (verif?.status === 'pending') {
    verifEl.innerHTML = '<span class="tag">⏳ Under review</span>';
  } else {
    verifEl.innerHTML = '<a href="/verification.html" class="button accent" style="font-size:13px;padding:8px 14px">Get verified →</a>';
  }
}
