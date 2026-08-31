import '../security/screen-guard.js';
import { requireSession } from '../lib/auth.js';
import { currentCouple } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';

const session = await requireSession();
const uid     = session.user.id;
const grid    = document.querySelector('#vaultGrid');
const status  = document.querySelector('#status');

// ── Load vault media ──────────────────────────────────────────────────────────
async function loadVault() {
  const couple = await currentCouple();
  if (!couple) {
    grid.innerHTML = '<p class="status">Pair with your partner first to use the private vault.</p>';
    return;
  }

  const { data, error } = await supabase
    .from('media')
    .select('id, file_name, file_type, storage_path, created_at')
    .eq('couple_id', couple.id)
    .eq('is_vault', true)
    .order('created_at', { ascending: false });

  if (error) { grid.innerHTML = `<p class="status">${error.message}</p>`; return; }
  grid.innerHTML = '';

  if (!data || data.length === 0) {
    grid.innerHTML = '<p class="status">Your vault is empty. Upload private photos or videos below.</p>';
    return;
  }

  for (const item of data) {
    const card  = document.createElement('div');
    card.className = 'vault-card';
    card.style = 'border:1px solid #eee;border-radius:14px;overflow:hidden;cursor:pointer;background:#111';
    card.innerHTML = item.file_type?.startsWith('image')
      ? `<div style="height:120px;display:grid;place-items:center;font-size:32px">🖼️</div>`
      : `<div style="height:120px;display:grid;place-items:center;font-size:32px">🎬</div>`;
    const info  = document.createElement('div');
    info.style  = 'padding:8px;background:#fff;font-size:12px';
    info.textContent = item.file_name || 'Private file';
    card.appendChild(info);

    card.onclick = async () => {
      status.textContent = 'Loading…';
      // Always use signed URL — never public URL
      const { data: signedData, error: signErr } = await supabase.storage
        .from('couple-vault')
        .createSignedUrl(item.storage_path, 120); // 2 min URL
      if (signErr) { status.textContent = signErr.message; return; }
      window.open(signedData.signedUrl, '_blank');
      status.textContent = 'Opened (link expires in 2 minutes)';
    };
    grid.appendChild(card);
  }
}

// ── Upload to vault ───────────────────────────────────────────────────────────
document.querySelector('#uploadForm').onsubmit = async e => {
  e.preventDefault();
  const file   = document.querySelector('#vaultFile').files[0];
  if (!file) return;

  const couple = await currentCouple();
  if (!couple) { status.textContent = 'Pair with your partner first.'; return; }

  // 50 MB limit
  if (file.size > 50 * 1024 * 1024) {
    status.textContent = 'File too large. Maximum 50 MB.';
    return;
  }

  status.textContent = 'Uploading…';
  const path = `${couple.id}/${uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;

  const { error: upErr } = await supabase.storage
    .from('couple-vault')
    .upload(path, file, { upsert: false });

  if (upErr) { status.textContent = upErr.message; return; }

  const { error: dbErr } = await supabase.from('media').insert({
    couple_id:    couple.id,
    uploaded_by:  uid,
    file_name:    file.name,
    file_type:    file.type,
    storage_path: path,
    is_vault:     true,
    size_bytes:   file.size
  });

  if (dbErr) { status.textContent = dbErr.message; return; }
  status.textContent = 'Uploaded to vault ✓';
  document.querySelector('#uploadForm').reset();
  loadVault();
};

loadVault();
