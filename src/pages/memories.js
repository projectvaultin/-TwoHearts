import { requireSession } from '../lib/auth.js';
import { currentCouple } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';

const session = await requireSession();
const uid     = session.user.id;
const form    = document.querySelector('#memoryForm');
const list    = document.querySelector('#memoryList');

function renderCard(m) {
  const card = document.createElement('article');
  card.className = 'panel';
  card.innerHTML = `<b>${m.title.replace(/[<>]/g,'')}</b>
    <p>${(m.caption||'').replace(/[<>]/g,'')}</p>
    <small>${m.memory_date || ''}</small>`;
  return card;
}

async function load() {
  const couple = await currentCouple();
  if (!couple) {
    list.innerHTML = '<p class="status">Pair with your partner first to share memories.</p>';
    return;
  }

  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .eq('couple_id', couple.id)
    .order('memory_date', { ascending: false });

  if (error) { list.innerHTML = `<p class="status">${error.message}</p>`; return; }
  list.innerHTML = '';
  (data || []).forEach(m => list.appendChild(renderCard(m)));
}

form.onsubmit = async e => {
  e.preventDefault();
  const couple = await currentCouple();
  if (!couple) { alert('Pair with your partner first.'); return; }

  const { error } = await supabase.from('memories').insert({
    couple_id:   couple.id,
    created_by:  uid,
    title:       document.querySelector('#memoryTitle').value.trim(),
    caption:     document.querySelector('#memoryCaption').value.trim(),
    memory_date: document.querySelector('#memoryDate').value || new Date().toISOString().slice(0,10)
  });

  if (error) { alert(error.message); return; }
  form.reset();
  load();
};

load();
