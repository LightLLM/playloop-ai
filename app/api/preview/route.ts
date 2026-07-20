import { env } from "cloudflare:workers";
import {
  generatePreviewHtml,
  enhancePreviewWithGeneratedArt,
  enhancePreviewWithTouch,
  validatePreviewArtifact,
} from "../../project-generator.mjs";
import { authorizeJob } from "../../security.mjs";

export async function GET(request: Request) {
  const url = new URL(request.url),
    id = url.searchParams.get("id"),
    requestedVersion = Number(url.searchParams.get("version") || 0);
  if (!id) return Response.json({ error: "Missing build id" }, { status: 400 });
  const access = await authorizeJob(request, id);
  if (!access.ok) return access.response;
  const row =
    requestedVersion > 0
      ? await env.DB.prepare(
          "SELECT project_json,fingerprint,version FROM build_versions WHERE job_id=? AND version=?",
        )
          .bind(id, requestedVersion)
          .first<{
            project_json: string;
            fingerprint: string;
            version: number;
          }>()
      : await env.DB.prepare(
          "SELECT project_json,fingerprint,version FROM build_versions WHERE job_id=? ORDER BY version DESC LIMIT 1",
        )
          .bind(id)
          .first<{
            project_json: string;
            fingerprint: string;
            version: number;
          }>();
  if (!row?.project_json)
    return Response.json({ error: "Preview is not ready" }, { status: 404 });
  const project = JSON.parse(row.project_json),
    spec = JSON.parse(project.files["game-spec.json"]),
    html = enhancePreviewWithGeneratedArt(
      enhancePreviewWithTouch(generatePreviewHtml(spec)),
      spec,
    ),
    check = validatePreviewArtifact(html);
  if (!check.valid)
    return Response.json(
      { error: "Preview failed validation", details: check.errors },
      { status: 422 },
    );
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; media-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
      "cache-control":
        requestedVersion > 0
          ? "private, max-age=31536000, immutable"
          : "private, no-store",
      etag: `"${row.fingerprint}"`,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
