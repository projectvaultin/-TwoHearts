// WebRTC transport foundation.
// Signaling must be authenticated and routed through the backend.
// TURN credentials must be short-lived and server-issued.
export function createPeerConnection(iceServers=[]){
  return new RTCPeerConnection({iceServers});
}
