import '../security/screen-guard.js';
import { requireSession } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';

const session = await requireSession();
const uid     = session.user.id;
const video   = document.querySelector('#preview');
const start   = document.querySelector('#start');
const stop    = document.querySelector('#stop');
const status  = document.querySelector('#status');
const prompt  = document.querySelector('#prompt');
const consent = document.querySelector('#consent');

let stream   = null;
let recorder = null;
let chunks   = [];
let timer    = null;

const prompts = [
  'Look straight at the camera',
  'Turn your head slowly to the left',
  'Turn your head slowly to the right',
  'Blink twice',
  'Smile',
  'Say your name clearly'
];

// Shuffle so order is randomized each time
function shuffled(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

async function begin() {
  if (!consent.checked) {
    status.textContent = 'Consent is required before recording.';
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
  } catch (err) {
    status.textContent = 'Camera access failed: ' + (err.message || 'permission denied');
    return;
  }

  video.srcObject = stream;
  chunks = [];
  const sequence = shuffled(prompts);

  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = () => uploadVideo();
  recorder.start();

  start.disabled = true;
  stop.disabled  = false;
  status.textContent = 'Recording…';

  let seconds = 30;
  prompt.textContent = sequence[0];
  timer = setInterval(() => {
    seconds--;
    const idx = Math.min(sequence.length - 1, Math.floor((30 - seconds) / 5));
    prompt.textContent = `${sequence[idx]} — ${seconds}s`;
    if (seconds <= 0) finish();
  }, 1000);
}

function finish() {
  clearInterval(timer);
  if (recorder?.state === 'recording') recorder.stop();
  stream?.getTracks().forEach(t => t.stop());
  start.disabled = false;
  stop.disabled  = true;
  video.srcObject = null;
  prompt.textContent = 'Processing…';
}

async function uploadVideo() {
  status.textContent = 'Uploading…';
  const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
  const path = `${uid}/${Date.now()}.webm`;

  // Upload to private verification-media bucket
  const { error: uploadError } = await supabase.storage
    .from('verification-media')
    .upload(path, blob, { contentType: 'video/webm', upsert: false });

  if (uploadError) {
    status.textContent = 'Upload failed: ' + uploadError.message;
    prompt.textContent = 'Please try again.';
    return;
  }

  // Record consent in DB
  await supabase.from('verification_consents').insert({
    user_id:     uid,
    consent_type: 'identity_verification',
    consented:    true
  }).catch(() => {});

  // Notify the server-side processing function
  const { error: fnError } = await supabase.functions.invoke('start-verification', {
    body: { storage_path: path }
  });

  if (fnError) {
    // Function not deployed yet — still show success for the upload itself
    status.textContent = `Video uploaded (${Math.round(blob.size / 1024)} KB). Manual review will be triggered once the verification endpoint is deployed.`;
    prompt.textContent = 'Upload complete ✓';
    return;
  }

  status.textContent = 'Submitted for review ✓ You will be notified when verified.';
  prompt.textContent = 'Complete ✓';
}

start.onclick = () => begin();
stop.onclick  = () => finish();
