import '../security/screen-guard.js';
import { requireSession } from '../lib/auth.js'; import { createPeerConnection } from '../lib/webrtc.js'; await requireSession();
const status=document.querySelector('#callStatus'); document.querySelector('#voice').onclick=()=>status.textContent='Voice call UI ready; authenticated signaling and TURN configuration required.'; document.querySelector('#video').onclick=()=>status.textContent='Video call UI ready; authenticated signaling and TURN configuration required.'; document.querySelector('#hangup').onclick=()=>status.textContent='Call ended.';
