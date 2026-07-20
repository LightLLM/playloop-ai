import { env } from "cloudflare:workers";
import { authorizeJob, consumeQuota } from "../../security.mjs";
import {
  generateProject,
  projectFingerprint,
} from "../../project-generator.mjs";

const allowedKinds = new Set(["environment", "hero", "props", "spritesheet"]);
async function ensureTable() {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS generated_assets (id TEXT PRIMARY KEY,job_id TEXT NOT NULL,kind TEXT NOT NULL,object_key TEXT NOT NULL,prompt TEXT NOT NULL,model TEXT NOT NULL,moderation_status TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS version_lineage (version_id TEXT PRIMARY KEY,parent_version_id TEXT,operation TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
}

async function attachAssetToVersion(
  jobId: string,
  spec: any,
  kind: string,
  id: string,
) {
  const url = `/api/assets?id=${id}`;
  spec.art.generated = { ...(spec.art.generated || {}), [kind]: url };
  spec.art.provenance = {
    ...(spec.art.provenance || {}),
    [kind]: {
      assetId: id,
      model: "gpt-image-1.5",
      moderation: "passed",
      source: "openai-generated",
      immutable: true,
    },
  };
  await env.DB.prepare(
    "UPDATE build_jobs SET spec_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
  )
    .bind(JSON.stringify(spec), jobId)
    .run();
  const parent = await env.DB.prepare(
    "SELECT id,version FROM build_versions WHERE job_id=? ORDER BY version DESC LIMIT 1",
  )
    .bind(jobId)
    .first<{ id: string; version: number }>();
  if (!parent) throw new Error("Build version missing");
  const project = generateProject(spec),
    fingerprint = projectFingerprint(project),
    versionId = crypto.randomUUID(),
    version = parent.version + 1;
  await env.DB.prepare(
    "INSERT INTO build_versions (id,job_id,version,fingerprint,project_json) VALUES (?,?,?,?,?)",
  )
    .bind(versionId, jobId, version, fingerprint, JSON.stringify(project))
    .run();
  await env.DB.prepare(
    "INSERT INTO version_lineage (version_id,parent_version_id,operation) VALUES (?,?,'asset')",
  )
    .bind(versionId, parent.id)
    .run();
  return { url, versionId, version, fingerprint };
}

export async function POST(request: Request) {
  await ensureTable();
  const body = (await request.json()) as { jobId?: string; kind?: string },
    jobId = body.jobId || "",
    kind = body.kind || "";
  if (!jobId || !allowedKinds.has(kind))
    return Response.json({ error: "Invalid asset request" }, { status: 400 });
  const access = await authorizeJob(request, jobId);
  if (!access.ok) return access.response;
  const existing = await env.DB.prepare(
    "SELECT id FROM generated_assets WHERE job_id=? AND kind=? ORDER BY created_at DESC LIMIT 1",
  )
    .bind(jobId, kind)
    .first<{ id: string }>();
  if (existing) {
    const build = await env.DB.prepare(
      "SELECT spec_json FROM build_jobs WHERE id=?",
    )
      .bind(jobId)
      .first<{ spec_json: string }>();
    const savedSpec = JSON.parse(build.spec_json),
      url = `/api/assets?id=${existing.id}`;
    if (savedSpec.art?.generated?.[kind] === url) {
      const latest = await env.DB.prepare(
        "SELECT id,version,fingerprint FROM build_versions WHERE job_id=? ORDER BY version DESC LIMIT 1",
      )
        .bind(jobId)
        .first<{ id: string; version: number; fingerprint: string }>();
      return Response.json({
        id: existing.id,
        kind,
        url,
        model: "gpt-image-1.5",
        reused: true,
        versionId: latest?.id,
        version: latest?.version,
        fingerprint: latest?.fingerprint,
      });
    }
    const attached = await attachAssetToVersion(
      jobId,
      savedSpec,
      kind,
      existing.id,
    );
    return Response.json({
      id: existing.id,
      kind,
      model: "gpt-image-1.5",
      reused: true,
      ...attached,
    });
  }
  const quota = await consumeQuota(access.actor.ownerId, "asset", 20);
  if (!quota.ok)
    return Response.json(
      { error: "Daily asset quota reached" },
      { status: 429, headers: { "retry-after": String(quota.retryAfter) } },
    );
  const row = await env.DB.prepare(
    "SELECT spec_json,status FROM build_jobs WHERE id=?",
  )
    .bind(jobId)
    .first<{ spec_json: string | null; status: string }>();
  if (!row?.spec_json || row.status !== "completed")
    return Response.json({ error: "Build not ready" }, { status: 404 });
  const spec = JSON.parse(row.spec_json),
    prompt = String(spec.art?.manifest?.[kind] || "").slice(0, 3000),
    apiKey = (env as any).OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey)
    return Response.json(
      { error: "Asset generation is not configured" },
      { status: 503 },
    );
  const headers = {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  };
  const moderation = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers,
    body: JSON.stringify({ model: "omni-moderation-latest", input: prompt }),
  });
  if (!moderation.ok)
    return Response.json({ error: "Moderation unavailable" }, { status: 502 });
  const moderationResult: any = await moderation.json();
  if (moderationResult.results?.[0]?.flagged)
    return Response.json(
      { error: "Asset prompt was blocked" },
      { status: 422 },
    );
  const image = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-image-1.5",
      prompt,
      size: kind === "environment" ? "1536x1024" : "1024x1024",
      quality: "medium",
      background: kind === "environment" ? "opaque" : "transparent",
      output_format: "webp",
      moderation: "auto",
    }),
  });
  if (!image.ok)
    return Response.json({ error: "Image generation failed" }, { status: 502 });
  const payload: any = await image.json(),
    base64 = payload.data?.[0]?.b64_json;
  if (!base64)
    return Response.json({ error: "Image output missing" }, { status: 502 });
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
    id = crypto.randomUUID(),
    objectKey = `builds/${jobId}/${kind}-${id}.webp`,
    bucket = (env as any).GAME_ASSETS;
  if (!bucket)
    return Response.json(
      { error: "Asset storage unavailable" },
      { status: 503 },
    );
  await bucket.put(objectKey, bytes, {
    httpMetadata: {
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: { jobId, kind, model: "gpt-image-1.5" },
  });
  await env.DB.prepare(
    "INSERT INTO generated_assets (id,job_id,kind,object_key,prompt,model,moderation_status) VALUES (?,?,?,?,?,'gpt-image-1.5','passed')",
  )
    .bind(id, jobId, kind, objectKey, prompt)
    .run();
  const attached = await attachAssetToVersion(jobId, spec, kind, id);
  return Response.json({
    id,
    kind,
    model: "gpt-image-1.5",
    ...attached,
  });
}

export async function GET(request: Request) {
  await ensureTable();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing asset id" }, { status: 400 });
  const row = await env.DB.prepare(
    "SELECT object_key FROM generated_assets WHERE id=?",
  )
    .bind(id)
    .first<{ object_key: string }>();
  if (!row) return Response.json({ error: "Asset not found" }, { status: 404 });
  const object = await (env as any).GAME_ASSETS?.get(row.object_key);
  if (!object)
    return Response.json({ error: "Asset data missing" }, { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType || "image/webp",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
