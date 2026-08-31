import { requireSession } from '../../lib/auth.js';
import { currentCouple, currentUser } from '../../lib/db.js';
import { supabase } from '../../lib/supabase.js';
import { toast, toggleDarkMode, initInstallBanner, initIdleTimeout, esc } from '../../lib/ui.js';

const session = await requireSession();
const user    = await currentUser();
const uid     = user.id;

// Dark mode toggle
document.querySelector('#themeToggle').onclick = () => {
  toggleDarkMode();
  const isDark = document.documentElement.dataset.theme === 'dark';
  document.querySelector('#themeToggle').textContent = isDark ? '☀️' : '🌙';
};

// Idle timeout — sign out after 15 min idle
initIdleTimeout(async () => {
  await supabase.auth.signOut();
  toast('Signed out due to inactivity', 'info');
  location.href = '/login.html';
}, 15);

// PWA install banner
initInstallBanner();

// ── Profile name ──────────────────────────────────────────────────────────────
const { data: profile } = await supabase
  .from('profiles')
  .select('display_name, avatar_url')
  .eq('id', uid)
  .maybeSingle();

const name = profile?.display_name || '';
document.querySelector('#welcome').textContent = `Welcome${name ? ', ' + name : ''} ❤️`;

// ── Couple status ─────────────────────────────────────────────────────────────
const couple  = await currentCouple();
const summary = document.querySelector('#coupleSummary');
const counter = document.querySelector('#dateCounter');

if (couple?.partner_b) {
  const { data: partnerProf } = await supabase
    .from('profiles').select('display_name').eq('id',
      couple.partner_a === uid ? couple.partner_b : couple.partner_a
    ).maybeSingle();

  summary.innerHTML = `Connected with <b>${esc(partnerProf?.display_name || 'your partner')}</b> 💕`;

  if (couple.relationship_date) {
    const days = Math.floor((Date.now() - new Date(couple.relationship_date + 'T00:00:00')) / 86400000);
    counter.innerHTML = `
      <div class="date-card">
        <span class="lbl">Together for</span>
        <span class="count">${days}</span>
        <span class="lbl">days 💕</span>
      </div>`;
  }

  // Unread messages
  const { data: conv } = await supabase.from('conversations')
    .select('id').eq('couple_id', couple.id).maybeSingle();
  if (conv) {
    const { count } = await supabase.from('messages')
      .select('id', { count:'exact', head:true })
      .eq('conversation_id', conv.id)
      .neq('sender_id', uid)
      .is('deleted_at', null);
    const badge = document.querySelector('#chatBadge');
    if (badge && count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.style.display='inline'; }
  }
} else if (couple && !couple.partner_b) {
  summary.innerHTML = `Waiting for your partner. <a href="/couple.html">Share your code →</a>`;
} else {
  summary.innerHTML = `<a href="/couple.html">Pair with your partner</a> to unlock your shared space.`;
}

// ── Mood picker ───────────────────────────────────────────────────────────────
const moods   = ['😊','😍','😴','😤','😭','🥰','😂','🤔','😰','😌'];
const moodRow = document.querySelector('#moodRow');
moods.forEach(m => {
  const btn = document.createElement('button');
  btn.className   = 'mood-btn';
  btn.textContent = m;
  btn.title       = 'Share this mood';
  btn.onclick     = async () => {
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    if (couple) {
      await supabase.from('timeline_events').insert({
        couple_id: couple.id, created_by: uid,
        title: `Mood: ${m}`, event_date: new Date().toISOString().slice(0,10),
        description: `Feeling ${m} today`
      });
      toast(`Mood ${m} shared with your partner`, 'success');
    } else {
      toast('Pair with your partner to share moods', 'info');
    }
  };
  moodRow.appendChild(btn);
});

// ── Thinking of you button ─────────────────────────────────────────────────
const thinkBtn = document.querySelector('#thinkingOfYouBtn');
if (thinkBtn && couple?.partner_b) {
  thinkBtn.style.display = 'flex';
  thinkBtn.onclick = async () => {
    const { sendThinkingOfYou } = await import('../../lib/ui.js');
    await sendThinkingOfYou(couple.id, uid);
    thinkBtn.textContent = '💭 Sent! ❤️';
    thinkBtn.disabled = true;
    setTimeout(() => { thinkBtn.textContent = '💭 Thinking of you'; thinkBtn.disabled = false; }, 5000);
    toast('Ping sent to your partner 💕', 'success');
  };
}
