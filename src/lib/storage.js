import { supabase } from './supabase.js';
export async function uploadEncrypted(bucket,path,file){ return supabase.storage.from(bucket).upload(path,file,{upsert:false}); }
// All TwoHearts storage buckets (couple-media, couple-vault, verification-media,
// call-recordings) are private. getPublicUrl() returns a URL that only works if the
// bucket is public and would silently expose private content, so private buckets
// must always use a short-lived signed URL instead.
export async function privateUrl(bucket,path,expiresInSeconds=60){
  const {data,error}=await supabase.storage.from(bucket).createSignedUrl(path,expiresInSeconds);
  if(error) throw error;
  return data.signedUrl;
}
