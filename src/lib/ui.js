import { supabase } from './supabase.js';

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastContainer = null;
function getContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function toast(message, type = 'info', duration = 3500) {
  const t    = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success:'✓', error:'✕', info:'ℹ' };
  t.innerHTML = `<span>${icons[type]||'ℹ'}</span><span>${message}</span>`;
  getContainer().appendChild(t);
  if (navigator.vibrate && type === 'success') navigator.vibrate(15);
  if (navigator.vibrate && type === 'error')   navigator.vibrate([50,50,50]);
  setTimeout(() => {
    t.style.opacity   = '0';
    t.style.transform = 'translateX(100%)';
    t.style.transition= 'all .3s';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// ── Dark mode ─────────────────────────────────────────────────────────────────
export function initDarkMode() {
  const stored     = localStorage.getItem('theme');
  const prefersDark= window.matchMedia('(prefers-color-scheme:dark)').matches;
  const theme      = stored || (prefersDark ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme'))
      document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
  });
}

export function toggleDarkMode() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
}

// ── PWA install ───────────────────────────────────────────────────────────────
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.querySelector('.install-banner')?.classList.add('visible');
});

export function initInstallBanner() {
  const banner     = document.querySelector('.install-banner');
  if (!banner) return;
  const installBtn = banner.querySelector('#installBtn');
  const dismissBtn = banner.querySelector('#dismissInstall');
  if (installBtn) {
    installBtn.onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      banner.classList.remove('visible');
      if (outcome === 'accepted') toast('App installed! ❤️', 'success');
    };
  }
  if (dismissBtn) {
    dismissBtn.onclick = () => {
      banner.classList.remove('visible');
      sessionStorage.setItem('installDismissed','1');
    };
  }
  if (sessionStorage.getItem('installDismissed')) banner.classList.remove('visible');
  if (window.matchMedia('(display-mode:standalone)').matches) banner.classList.remove('visible');
}

// ── Idle timeout ──────────────────────────────────────────────────────────────
export function initIdleTimeout(logoutCallback, idleMinutes = 15) {
  let timer;
  const reset = () => { clearTimeout(timer); timer = setTimeout(logoutCallback, idleMinutes * 60000); };
  ['mousemove','keydown','touchstart','scroll','click'].forEach(ev =>
    document.addEventListener(ev, reset, { passive:true }));
  reset();
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function skeletonLines(n = 3) {
  return Array.from({length:n}, () =>
    `<div class="skeleton skeleton-line" style="width:${60+Math.random()*35}%"></div>`
  ).join('');
}

// ── Time ago ──────────────────────────────────────────────────────────────────
export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const s    = Math.floor(diff / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  if (s < 604800) return `${Math.floor(s/86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Escape HTML ───────────────────────────────────────────────────────────────
export function esc(str) {
  return (str||'').replace(/[<>&"']/g,
    c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── Thinking of you ping ──────────────────────────────────────────────────────
export async function sendThinkingOfYou(coupleId, senderId) {
  await supabase.from('timeline_events').insert({
    couple_id:   coupleId,
    created_by:  senderId,
    title:       '💭 Thinking of you',
    description: 'Sent a "thinking of you" ping',
    event_date:  new Date().toISOString().slice(0,10)
  });
  // Could also trigger a push notification via Edge Function
  return true;
}

// ── Service worker update notification ────────────────────────────────────────
export function initSWUpdateNotice() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const banner = document.createElement('div');
    banner.style = `position:fixed;top:70px;left:12px;right:12px;background:var(--accent);color:#fff;
      border-radius:14px;padding:14px 18px;z-index:300;display:flex;align-items:center;gap:12px;
      box-shadow:0 8px 32px rgba(124,58,237,.3)`;
    banner.innerHTML = `<span style="flex:1;font-size:14px;font-weight:600">✨ Update available</span>
      <button onclick="location.reload()" style="background:rgba(255,255,255,.25);border:0;color:#fff;
        border-radius:8px;padding:6px 14px;cursor:pointer;font:inherit;font-weight:700">Refresh</button>`;
    document.body.appendChild(banner);
  });
}

// Auto-init
initDarkMode();
initSWUpdateNotice();
