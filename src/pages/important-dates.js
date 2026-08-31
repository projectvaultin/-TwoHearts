import { requireSession } from '../lib/auth.js';
import { currentCouple } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';
import { toast, esc } from '../lib/ui.js';

const session = await requireSession();
const uid     = session.user.id;
const couple  = await currentCouple();

function daysUntil(dateStr, recurring) {
  const today = new Date();
  today.setHours(0,0,0,0);
  let target = new Date(dateStr + 'T00:00:00');

  if (recurring === 'yearly') {
    target.setFullYear(today.getFullYear());
    if (target < today) target.setFullYear(today.getFullYear() + 1);
  }

  return Math.ceil((target - today) / 86400000);
}

function countdownLabel(days) {
  if (days === 0) return '🎉 TODAY!';
  if (days === 1) return '⏰ Tomorrow!';
  if (days <= 7)  return `⏳ ${days} days away`;
  if (days <= 30) return `📅 ${days} days away`;
  return `🗓️ ${days} days away`;
}

function emoji(title) {
  const t = title.toLowerCase();
  if (t.includes('birthday'))    return '🎂';
  if (t.includes('anniversary')) return '💑';
  if (t.includes('wedding'))     return '💍';
  if (t.includes('valentine'))   return '❤️';
  if (t.includes('christmas'))   return '🎄';
  return '⭐';
}

async function load() {
  const upcomingEl = document.querySelector('#upcomingList');
  const listEl     = document.querySelector('#dateList');

  if (!couple) {
    upcomingEl.innerHTML = '';
    listEl.innerHTML = '<p class="status">Pair with your partner first to share important dates.</p>';
    return;
  }

  const { data, error } = await supabase
    .from('important_dates')
    .select('*')
    .eq('couple_id', couple.id)
    .order('date', { ascending: true });

  if (error) { listEl.innerHTML = `<p class="status">${error.message}</p>`; return; }
  if (!data?.length) {
    upcomingEl.innerHTML = '';
    listEl.innerHTML = '<p class="status">No important dates yet. Add one below!</p>';
    return;
  }

  // Upcoming (within 30 days)
  const upcoming = data
    .map(d => ({ ...d, days: daysUntil(d.date, d.recurring) }))
    .filter(d => d.days >= 0 && d.days <= 30)
    .sort((a,b) => a.days - b.days);

  upcomingEl.innerHTML = '';
  if (upcoming.length > 0) {
    const heading = document.createElement('h2');
    heading.className = 'mb';
    heading.textContent = '⏰ Coming up';
    upcomingEl.appendChild(heading);

    upcoming.forEach(d => {
      const card = document.createElement('div');
      card.className = 'date-card';
      card.style = 'margin-bottom:12px';
      card.innerHTML = `
        <span class="lbl">${countdownLabel(d.days)}</span>
        <span class="count" style="font-size:40px">${emoji(d.title)} ${esc(d.title)}</span>
        <span class="lbl">${new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</span>`;
      upcomingEl.appendChild(card);
    });
  }

  // All dates
  listEl.innerHTML = '';
  data.forEach(d => {
    const days = daysUntil(d.date, d.recurring);
    const row  = document.createElement('div');
    row.style  = 'display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--border)';
    row.innerHTML = `
      <div style="font-size:32px">${emoji(d.title)}</div>
      <div style="flex:1">
        <b>${esc(d.title)}</b>
        <small style="display:block;color:var(--muted)">
          ${new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}
          · ${d.recurring === 'yearly' ? 'Yearly' : 'One time'}
          · Reminder: ${d.reminder_days} day${d.reminder_days>1?'s':''} before
        </small>
      </div>
      <div style="text-align:right">
        <span style="font-size:13px;font-weight:700;color:var(--accent)">${days >= 0 ? countdownLabel(days) : 'Past'}</span>
        <button class="icon-btn" data-id="${d.id}" title="Delete" style="display:block;margin-top:4px;font-size:16px">🗑</button>
      </div>`;
    row.querySelector('button').onclick = async () => {
      if (!confirm('Delete this date?')) return;
      await supabase.from('important_dates').delete().eq('id', d.id).eq('couple_id', couple.id);
      toast('Date deleted','info');
      load();
    };
    listEl.appendChild(row);
  });
}

document.querySelector('#dateForm').onsubmit = async e => {
  e.preventDefault();
  const status = document.querySelector('#dateStatus');

  if (!couple) { status.textContent = 'Pair with your partner first.'; return; }

  const title    = document.querySelector('#dateTitle').value.trim();
  const date     = document.querySelector('#dateValue').value;
  const recurring= document.querySelector('#dateRecurring').value;
  const reminder = parseInt(document.querySelector('#dateReminder').value);

  status.textContent = 'Saving…';

  const { error } = await supabase.from('important_dates').insert({
    couple_id:     couple.id,
    created_by:    uid,
    title,
    date,
    recurring,
    reminder_days: reminder
  });

  if (error) { status.textContent = error.message; return; }
  document.querySelector('#dateForm').reset();
  status.textContent = '';
  toast(`${title} saved ✓`, 'success');
  load();
};

load();
