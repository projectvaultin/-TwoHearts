// TwoHearts privileged function: admin-search-conversations
// Search conversation metadata by authorized admin request; never return message plaintext unless the separate privileged viewer function authorizes it.
// Never expose the service-role key to the browser.
// Never bypass authorization based only on a client-supplied role.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'method_not_allowed'}),{status:405,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({ok:false,configured:false,function:'admin-search-conversations'}),{status:501,headers:{'content-type':'application/json'}});
});
