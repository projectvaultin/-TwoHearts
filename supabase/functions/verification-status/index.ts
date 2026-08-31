// TwoHearts verification function: verification-status
// Return the current user's verification status without exposing verification media.
// Never put provider secrets or service-role keys in the browser.
// Never log raw verification video or biometric data.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'method_not_allowed'}),{status:405,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({ok:false,configured:false,function:'verification-status'}),{status:501,headers:{'content-type':'application/json'}});
});
