import { requireSession } from '../lib/auth.js';
import { currentCouple } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';
import { toast, esc, timeAgo } from '../lib/ui.js';

const session = await requireSession();
const uid     = session.user.id;
const couple  = await currentCouple();
const inbox   = document.querySelector('#notifInbox');

async function load() {
  inbox.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px">' +
    Array(4).fill('<div class="skeleton skeleton-line"></div>').join('') + '</div>';

  const notifs = [];

  // Connection requests
  const { data: requests } = await supabase
    .from('matches')
    .select('id,user_a,created_at,profiles!matches_user_a_fkey(display_name,username)')
    .eq('user_b', uid).eq('status','pending')
    .order('created_at', { ascending: false });

  (requests||[]).forEach(r => notifs.push({
    type:    'connection_request',
    icon:    '🤝',
    title:   `${r.profiles?.display_name || 'Someone'} wants to connect`,
    body:    `@${r.profiles?.username || ''}`,
    time:    r.created_at,
    action:  `/connect.html`,
    badge:   'New'
  }));

  // Upcoming important dates (within 7 days)
  if (couple) {
    const { data: dates } = await supabase
      .from('important_dates')
      .select('title,date,reminder_days')
      .eq('couple_id', couple.id);

    (dates||[]).forEach(d => {
      const today  = new Date(); today.setHours(0,0,0,0);
      let target   = new Date(d.date + 'T00:00:00');
      if (d.recurring === 'yearly') {
        target.setFullYear(today.getFullYear());
        if (target < today) target.setFullYear(today.getFullYear() + 1);
      }
      const days = Math.ceil((target - today) / 86400000);
      if (days >= 0 && days <= (d.reminder_days || 7)) {
        notifs.push({
          type:  'important_date',
          icon:  days === 0 ? '🎉' : '🗓️',
          title: days === 0 ? `Today: ${d.title}!` : `${d.title} in ${days} day${days>1?'s':''}`,
          body:  new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long'}),
          time:  new Date().toISOString(),
          action:'/important-dates.html',
          badge: days === 0 ? 'Today' : `${days}d`
        });
      }
    });

    // Unrevealed surprises ready to show
    const { data: surprises } = await supabase
      .from('surprises')
      .select('id,reveal_at,sender_id')
      .eq('recipient_id', uid)
      .is('revealed_at', null)
      .lte('reveal_at', new Date().toISOString());

    if (surprises?.length) {
      notifs.push({
        type:   'surprise',
        icon:   '💌',
        title:  `You have ${surprises.length} surprise${surprises.length>1?'s':''} waiting!`,
        body:   'Your partner scheduled something special for you',
        time:   surprises[0].reveal_at,
        action: '/surprises.html',
        badge:  'Open'
      });
    }
  }

  // Security events (recent)
  const { data: secEvents } = await supabase
    .from('security_events')
    .select('event_type,created_at,metadata')
    .eq('user_id', uid)
    .gte('created_at', new Date(Date.now() - 7*86400000).toISOString())
    .order('created_at', { ascending:false })
    .limit(3);

  (secEvents||[]).forEach(ev => {
    if (ev.event_type === 'screenshot_key' || ev.event_type === 'screen_share_attempt') {
      notifs.push({
        type:   'security',
        icon:   '🛡️',
        title:  'Screenshot attempt detected',
        body:   `On ${ev.metadata?.page || 'a protected page'} · ${timeAgo(ev.created_at)}`,
        time:   ev.created_at,
        action: '/account.html',
        badge:  'Security'
      });
    }
  });

  // Sort by time descending
  notifs.sort((a,b) => new Date(b.time) - new Date(a.time));

  inbox.innerHTML = '';
  if (!notifs.length) {
    inbox.innerHTML = `<div style="text-align:center;padding:40px">
      <div style="font-size:56px;margin-bottom:16px">🔔</div>
      <h3>All caught up!</h3>
      <p>No new notifications right now.</p>
    </div>`;
    return;
  }

  notifs.forEach(n => {
    const card = document.createElement('a');
    card.href  = n.action;
    card.style = 'display:flex;align-items:center;gap:14px;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:16px;text-decoration:none;color:inherit;margin-bottom:10px;transition:all .2s';
    card.onmouseenter = () => card.style.borderColor = 'var(--accent)';
    card.onmouseleave = () => card.style.borderColor = 'var(--border)';
    card.innerHTML = `
      <div style="font-size:32px;flex-shrink:0">${n.icon}</div>
      <div style="flex:1;min-width:0">
        <b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n.title)}</b>
        <small style="color:var(--muted)">${esc(n.body)}</small>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <span style="background:rgba(124,58,237,.1);color:var(--accent);border-radius:99px;padding:3px 10px;font-size:11px;font-weight:800">${esc(n.badge)}</span>
        <small style="display:block;color:var(--muted);margin-top:4px">${timeAgo(n.time)}</small>
      </div>`;
    inbox.appendChild(card);
  });

  // Update badge in nav
  const badge = document.querySelector('#notifCount');
  if (badge) { badge.textContent = notifs.length; badge.style.display = notifs.length ? 'inline' : 'none'; }
}

load();
