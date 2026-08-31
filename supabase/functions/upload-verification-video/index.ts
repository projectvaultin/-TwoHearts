// TwoHearts verification function: upload-verification-video
// Accept authenticated verification video upload, validate session ownership, encrypt/store privately, and return only an object reference.
// Never put provider secrets or service-role keys in the browser.
// Never log raw verification video or biometric data.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'method_not_allowed'}),{status:405,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({ok:false,configured:false,function:'upload-verification-video'}),{status:501,headers:{'content-type':'application/json'}});
});
