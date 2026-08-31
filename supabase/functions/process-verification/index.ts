// TwoHearts verification function: process-verification
// Send the verification session to the configured identity/liveness provider and store only the minimum required result.
// Never put provider secrets or service-role keys in the browser.
// Never log raw verification video or biometric data.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'method_not_allowed'}),{status:405,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({ok:false,configured:false,function:'process-verification'}),{status:501,headers:{'content-type':'application/json'}});
});
