import { supabase } from './supabase.js';
export async function currentUser(){ const {data,error}=await supabase.auth.getUser(); if(error) throw error; return data.user; }
export async function currentCouple(){
  const user=await currentUser();
  if(!user) return null;
  const {data,error}=await supabase.from('couple_members').select('couple_id,couples(*)').eq('user_id',user.id).maybeSingle();
  if(error) throw error;
  return data?.couples ?? null;
}
