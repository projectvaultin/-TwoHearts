// TwoHearts privileged function: admin-revoke-session
// Revoke a user/device session after authorized security action and write an audit event.
// Never expose the service-role key to the browser.
// Never bypass authorization based only on a client-supplied role.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'method_not_allowed'}),{status:405,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({ok:false,configured:false,function:'admin-revoke-session'}),{status:501,headers:{'content-type':'application/json'}});
});
