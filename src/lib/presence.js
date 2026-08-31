/**
 * TwoHearts Presence — real online/offline tracking
 * Uses Supabase Realtime Presence channels
 */
import { supabase } from './supabase.js';

let presenceChannel = null;

/**
 * Start broadcasting this user's online status.
 * Call once per page after session is confirmed.
 */
export async function startPresence(userId, metadata = {}) {
  const channelName = 'online-users';

  presenceChannel = supabase.channel(channelName, {
    config: { presence: { key: userId } }
  });

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      // Presence state updated — notify listeners
      const state = presenceChannel.presenceState();
      window.dispatchEvent(new CustomEvent('presenceSync', { detail: state }));
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      window.dispatchEvent(new CustomEvent('presenceJoin', { detail: { userId: key, data: newPresences } }));
    })
    .on('presence', { event: 'leave' }, ({ key }) => {
      window.dispatchEvent(new CustomEvent('presenceLeave', { detail: { userId: key } }));
    })
    .subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          user_id:  userId,
          online_at: new Date().toISOString(),
          ...metadata
        });
      }
    });

  // Stop broadcasting when tab closes
  window.addEventListener('beforeunload', stopPresence);
  return presenceChannel;
}

/**
 * Check if a specific user is currently online.
 */
export function isOnline(userId) {
  if (!presenceChannel) return false;
  const state = presenceChannel.presenceState();
  return !!state[userId];
}

/**
 * Get all currently online user IDs.
 */
export function getOnlineUsers() {
  if (!presenceChannel) return [];
  return Object.keys(presenceChannel.presenceState());
}

export async function stopPresence() {
  if (presenceChannel) {
    await presenceChannel.untrack();
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
  }
}
