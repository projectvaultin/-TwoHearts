import { requireSession } from '../lib/auth.js';
import { currentCouple } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';

const session = await requireSession();
const uid     = session.user.id;
const form    = document.querySelector('#timelineForm');
const list    = document.querySelector('#timelineList');

function renderCard(ev) {
  const card = document.createElement('article');
  card.className = 'panel';
  card.innerHTML = `<b>${ev.title.replace(/[<>]/g,'')}</b>
    <p>${(ev.description||'').replace(/[<>]/g,'')}</p>
    <small>${ev.event_date}</small>`;
  return card;
}

async function load() {
  const couple = await currentCouple();
  if (!couple) {
    list.innerHTML = '<p class="status">Pair with your partner first to build your timeline.</p>';
    return;
  }

  const { data, error } = await supabase
    .from('timeline_events')
    .select('*')
    .eq('couple_id', couple.id)
    .order('event_date', { ascending: false });

  if (error) { list.innerHTML = `<p class="status">${error.message}</p>`; return; }
  list.innerHTML = '';
  (data || []).forEach(ev => list.appendChild(renderCard(ev)));
}

form.onsubmit = async e => {
  e.preventDefault();
  const couple = await currentCouple();
  if (!couple) { alert('Pair with your partner first.'); return; }

  const { error } = await supabase.from('timeline_events').insert({
    couple_id:   couple.id,
    created_by:  uid,
    title:       document.querySelector('#timelineTitle').value.trim(),
    description: document.querySelector('#timelineDescription').value.trim(),
    event_date:  document.querySelector('#timelineDate').value
  });

  if (error) { alert(error.message); return; }
  form.reset();
  load();
};

load();
