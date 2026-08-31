import { requireSession } from '../lib/auth.js';
import { currentCouple } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';

const session = await requireSession();
const uid     = session.user.id;
const status  = document.querySelector('#status');

async function getPartnerId(couple) {
  if (!couple) return null;
  return couple.partner_a === uid ? couple.partner_b : couple.partner_a;
}

document.querySelector('#surpriseForm').onsubmit = async e => {
  e.preventDefault();
  status.textContent = 'Scheduling…';

  const couple = await currentCouple();
  if (!couple) { status.textContent = 'Pair with your partner first.'; return; }

  const partnerId = await getPartnerId(couple);
  if (!partnerId) { status.textContent = 'Your partner has not joined yet.'; return; }

  const text     = document.querySelector('#surpriseText').value.trim();
  const revealAt = document.querySelector('#revealAt').value;

  if (!text || !revealAt) { status.textContent = 'Write a message and pick a reveal time.'; return; }

  const { error } = await supabase.from('surprises').insert({
    couple_id:    couple.id,
    sender_id:    uid,
    recipient_id: partnerId,
    ciphertext:   text,   // Production: encrypt before storing
    reveal_at:    new Date(revealAt).toISOString()
  });

  if (error) { status.textContent = error.message; return; }
  status.textContent = '💌 Surprise scheduled! Your partner will see it at the reveal time.';
  document.querySelector('#surpriseForm').reset();
};
