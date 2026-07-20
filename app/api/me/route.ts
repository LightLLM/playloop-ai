import { actorFor } from "../../security.mjs";

export async function GET(request:Request){
  const actor=await actorFor(request);
  if(!actor)return Response.json({authenticated:false,signIn:"/signin-with-chatgpt?return_to=%2F"},{status:401});
  return Response.json({authenticated:actor.authenticated,localDevelopment:!actor.authenticated});
}
