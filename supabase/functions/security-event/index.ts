// TwoHearts Edge Function: security-event
// Authenticate request, validate input, authorize resource, rate-limit.
// Never log plaintext private content. Keep service-role credentials server-side.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'method_not_allowed'}),{status:405,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({ok:false,function:'security-event',configured:false}),{status:501,headers:{'content-type':'application/json'}});
});
