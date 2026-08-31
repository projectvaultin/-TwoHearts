import { supabase } from './supabase.js';
export function subscribeToMessages(conversationId, callback){
  return supabase.channel(`messages:${conversationId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:`conversation_id=eq.${conversationId}`},callback)
    .subscribe();
}
