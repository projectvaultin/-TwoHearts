import { requireSession } from '../lib/auth.js';
import { currentCouple } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';

const session = await requireSession();
const uid     = session.user.id;
const form    = document.querySelector('#journalForm');
const list    = document.querySelector('#journalList');

function renderCard(entry) {
  const card = document.createElement('article');
  card.className = 'panel';
  // Journal entries are stored as ciphertext (plaintext in this foundation)
  card.innerHTML = `<p>${(entry.ciphertext||'').replace(/[<>]/g,'')}</p>
    <small>${entry.entry_date}</small>`;
  return card;
}

async function load() {
  const couple = await currentCouple();
  if (!couple) {
    list.innerHTML = '<p class="status">Pair with your partner first to write together.</p>';
    return;
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('couple_id', couple.id)
    .is('deleted_at', null)
    .order('entry_date', { ascending: false });

  if (error) { list.innerHTML = `<p class="status">${error.message}</p>`; return; }
  list.innerHTML = '';
  (data || []).forEach(e => list.appendChild(renderCard(e)));
}

form.onsubmit = async e => {
  e.preventDefault();
  const text = document.querySelector('#journalText').value.trim();
  if (!text) return;

  const couple = await currentCouple();
  if (!couple) { alert('Pair with your partner first.'); return; }

  const { error } = await supabase.from('journal_entries').insert({
    couple_id:  couple.id,
    created_by: uid,
    ciphertext: text,   // Production: encrypt before storing
    entry_date: new Date().toISOString().slice(0,10)
  });

  if (error) { alert(error.message); return; }
  form.reset();
  load();
};

load();
