/**
 * TwoHearts — Discover & Connect
 *
 * Three ways to connect with someone:
 * 1. Share your personal @username link — they search you directly
 * 2. Scan / share a QR code (your unique profile code)
 * 3. Proximity discovery — see people nearby who have discovery mode on
 *
 * All connections require BOTH people to accept before any chat is visible.
 * Verified users are marked clearly.
 */

import { requireSession } from '../lib/auth.js';
import { currentUser } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';

const session = await requireSession();
const user    = await currentUser();
const uid     = user.id;

// ── Generate shareable profile link ──────────────────────────────────────────
async function getMyProfile() {
  const { data } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, about')
    .eq('id', uid)
    .maybeSingle();
  return data;
}

// ── Search for a user by username ─────────────────────────────────────────────
export async function searchUser(username) {
  const clean = username.replace('@','').toLowerCase().trim();
  if (!clean) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, about')
    .eq('username', clean)
    .maybeSingle();

  if (error || !data) return null;
  if (data.id === uid) return null; // can't connect with yourself

  // Check if blocked
  const { data: block } = await supabase
    .from('blocks')
    .select('blocker_id')
    .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`)
    .or(`blocker_id.eq.${data.id},blocked_id.eq.${data.id}`)
    .maybeSingle();

  if (block) return null;

  // Check verification status
  const { data: verification } = await supabase
    .from('identity_verifications')
    .select('status')
    .eq('user_id', data.id)
    .maybeSingle();

  return { ...data, verified: verification?.status === 'approved' };
}

// ── Send a connection request ─────────────────────────────────────────────────
export async function sendConnectionRequest(targetUserId, message = '') {
  // Store in matches table with status 'pending'
  const { error } = await supabase.from('matches').insert({
    user_a:   uid,
    user_b:   targetUserId,
    status:   'pending',
    message:  message.slice(0, 200)
  });
  return { error };
}

// ── Accept a connection request ───────────────────────────────────────────────
export async function acceptConnection(matchId) {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'matched', matched_at: new Date().toISOString() })
    .eq('id', matchId)
    .eq('user_b', uid); // only the recipient can accept
  return { error };
}

// ── Get pending incoming requests ─────────────────────────────────────────────
export async function getPendingRequests() {
  const { data, error } = await supabase
    .from('matches')
    .select('id, user_a, message, created_at, profiles!matches_user_a_fkey(display_name, username, avatar_url)')
    .eq('user_b', uid)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

// ── Get accepted connections ──────────────────────────────────────────────────
export async function getConnections() {
  const { data, error } = await supabase
    .from('matches')
    .select('id, user_a, user_b, matched_at')
    .or(`user_a.eq.${uid},user_b.eq.${uid}`)
    .eq('status', 'matched')
    .order('matched_at', { ascending: false });

  if (error || !data) return { data: [], error };

  // Get partner profiles
  const partnerIds = data.map(m => m.user_a === uid ? m.user_b : m.user_a);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .in('id', partnerIds);

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

  return {
    data: data.map(m => ({
      matchId:     m.id,
      matchedAt:   m.matched_at,
      partner:     profileMap[m.user_a === uid ? m.user_b : m.user_a]
    })),
    error: null
  };
}

// ── Generate my shareable profile URL ────────────────────────────────────────
export async function getShareableLink() {
  const profile = await getMyProfile();
  if (!profile) return null;
  return `${location.origin}/connect.html?u=${profile.username}`;
}
