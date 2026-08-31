export function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});}
export function requireBearer(req:Request){const h=req.headers.get('authorization');if(!h?.startsWith('Bearer '))throw new Error('Unauthorized');return h.slice(7);}
