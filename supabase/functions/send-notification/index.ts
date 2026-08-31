// TwoHearts Edge Function: send-notification
// Authenticate request, validate input, authorize resource, rate-limit.
// Never log plaintext private content. Keep service-role credentials server-side.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'method_not_allowed'}),{status:405,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({ok:false,function:'send-notification',configured:false}),{status:501,headers:{'content-type':'application/json'}});
});
