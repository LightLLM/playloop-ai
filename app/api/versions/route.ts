import { env } from "cloudflare:workers";
import { authorizeJob } from "../../security.mjs";

async function ensureTables() {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS version_lineage (version_id TEXT PRIMARY KEY,parent_version_id TEXT,operation TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS publications (slug TEXT PRIMARY KEY,job_id TEXT NOT NULL,version_id TEXT NOT NULL,fingerprint TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS sandbox_results (job_id TEXT PRIMARY KEY,version_id TEXT NOT NULL,status TEXT NOT NULL,stage TEXT NOT NULL,report_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
}
type Version = {
  id: string;
  job_id: string;
  version: number;
  fingerprint: string;
  project_json: string;
  created_at: string;
};
export async function GET(request: Request) {
  await ensureTables();
  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId)
    return Response.json({ error: "Missing job id" }, { status: 400 });
  const access = await authorizeJob(request, jobId);
  if (!access.ok) return access.response;
  const versions = await env.DB.prepare(
      "SELECT v.id,v.version,v.fingerprint,v.created_at,l.parent_version_id,l.operation,s.status AS qa_status FROM build_versions v LEFT JOIN version_lineage l ON l.version_id=v.id LEFT JOIN sandbox_results s ON s.version_id=v.id WHERE v.job_id=? ORDER BY v.version DESC",
    )
      .bind(jobId)
      .all(),
    publication = await env.DB.prepare(
      "SELECT slug,version_id,fingerprint,status,updated_at FROM publications WHERE job_id=? AND status='published' ORDER BY updated_at DESC LIMIT 1",
    )
      .bind(jobId)
      .first();
  return Response.json({ jobId, versions: versions.results, publication });
}
export async function POST(request: Request) {
  await ensureTables();
  const body = (await request.json()) as {
      action?: string;
      jobId?: string;
      versionId?: string;
    },
    action = body.action || "",
    jobId = body.jobId || "",
    versionId = body.versionId || "";
  if (!["publish", "rollback", "fork"].includes(action) || !jobId || !versionId)
    return Response.json(
      { error: "Invalid version operation" },
      { status: 400 },
    );
  const access = await authorizeJob(request, jobId);
  if (!access.ok) return access.response;
  const source = await env.DB.prepare(
    "SELECT id,job_id,version,fingerprint,project_json,created_at FROM build_versions WHERE id=? AND job_id=?",
  )
    .bind(versionId, jobId)
    .first<Version>();
  if (!source)
    return Response.json({ error: "Version not found" }, { status: 404 });
  if (action === "publish") {
    const qa = await env.DB.prepare(
      "SELECT status FROM sandbox_results WHERE job_id=? AND version_id=? ORDER BY created_at DESC LIMIT 1",
    ).bind(jobId, versionId).first<{ status: string }>();
    if (qa?.status !== "passed")
      return Response.json(
        { error: "This exact version must pass isolated build QA before publishing" },
        { status: 409 },
      );
    const slug = `${source.fingerprint}-${crypto.randomUUID().slice(0, 6)}`;
    await env.DB.prepare(
      "UPDATE publications SET status='superseded',updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND status='published'",
    )
      .bind(jobId)
      .run();
    await env.DB.prepare(
      "INSERT INTO publications (slug,job_id,version_id,fingerprint,status) VALUES (?,?,?,?,'published')",
    )
      .bind(slug, jobId, versionId, source.fingerprint)
      .run();
    return Response.json({
      action,
      slug,
      url: `/api/published?slug=${slug}`,
      fingerprint: source.fingerprint,
    });
  }
  const targetJob = action === "fork" ? crypto.randomUUID() : jobId;
  if (action === "fork") {
    const build = await env.DB.prepare(
      "SELECT prompt,spec_json FROM build_jobs WHERE id=?",
    )
      .bind(jobId)
      .first<{ prompt: string; spec_json: string }>();
    if (!build)
      return Response.json({ error: "Build not found" }, { status: 404 });
    await env.DB.prepare(
      "INSERT INTO build_jobs (id,prompt,status,spec_json) VALUES (?,?,'completed',?)",
    )
      .bind(targetJob, build.prompt, build.spec_json)
      .run();
    await env.DB.prepare(
      "INSERT INTO build_owners (job_id,owner_id) VALUES (?,?)",
    ).bind(targetJob, access.actor.ownerId).run();
  }
  const max =
      action === "fork"
        ? 0
        : (
            await env.DB.prepare(
              "SELECT MAX(version) AS max_version FROM build_versions WHERE job_id=?",
            )
              .bind(targetJob)
              .first<{ max_version: number | null }>()
          )?.max_version || 0,
    newId = crypto.randomUUID(),
    next = max + 1;
  await env.DB.prepare(
    "INSERT INTO build_versions (id,job_id,version,fingerprint,project_json) VALUES (?,?,?,?,?)",
  )
    .bind(newId, targetJob, next, source.fingerprint, source.project_json)
    .run();
  await env.DB.prepare(
    "INSERT INTO version_lineage (version_id,parent_version_id,operation) VALUES (?,?,?)",
  )
    .bind(newId, source.id, action)
    .run();
  return Response.json({
    action,
    jobId: targetJob,
    versionId: newId,
    version: next,
    fingerprint: source.fingerprint,
  });
}
