import { env } from "cloudflare:workers";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug)
    return Response.json({ error: "Missing publication" }, { status: 400 });
  const row = await env.DB.prepare(
    "SELECT p.fingerprint,c.object_key FROM publications p JOIN compiled_artifacts c ON c.version_id=p.version_id WHERE p.slug=? AND p.status='published'",
  )
    .bind(slug)
    .first<{ fingerprint: string; object_key: string }>();
  if (!row)
    return Response.json(
      { error: "Publication not found or compiled artifact unavailable" },
      { status: 404 },
    );
  const object = await (env as any).GAME_ASSETS?.get(row.object_key);
  if (!object)
    return Response.json(
      { error: "Published artifact data is missing" },
      { status: 404 },
    );
  return new Response(object.body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; media-src 'none'; frame-ancestors *; base-uri 'none'; form-action 'none'",
      "cache-control": "public, max-age=31536000, immutable",
      etag: `\"${row.fingerprint}\"`,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
