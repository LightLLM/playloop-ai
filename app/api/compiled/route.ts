import { env } from "cloudflare:workers";
import { authorizeJob } from "../../security.mjs";

export async function GET(request:Request){
  const url=new URL(request.url),jobId=url.searchParams.get("jobId")||"",versionId=url.searchParams.get("versionId")||"";
  if(!jobId||!versionId)return Response.json({error:"Missing compiled artifact id"},{status:400});
  const access=await authorizeJob(request,jobId);if(!access.ok)return access.response;
  const row=await env.DB.prepare("SELECT object_key FROM compiled_artifacts WHERE job_id=? AND version_id=?").bind(jobId,versionId).first<{object_key:string}>();if(!row)return Response.json({error:"Compiled artifact is not ready"},{status:404});
  const object=await (env as any).GAME_ASSETS?.get(row.object_key);if(!object)return Response.json({error:"Compiled artifact data is missing"},{status:404});
  return new Response(object.body,{headers:{"content-type":"text/html; charset=utf-8","content-security-policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; media-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'","cache-control":"private, max-age=31536000, immutable","x-content-type-options":"nosniff","referrer-policy":"no-referrer"}});
}
