// TwoHearts privileged function: admin-moderation
// Handle reports, abuse actions and moderation workflow with immutable audit records.
// Never expose the service-role key to the browser.
// Never bypass authorization based only on a client-supplied role.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'method_not_allowed'}),{status:405,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({ok:false,configured:false,function:'admin-moderation'}),{status:501,headers:{'content-type':'application/json'}});
});
