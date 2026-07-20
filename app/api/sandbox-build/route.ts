import { env } from "cloudflare:workers";
import { projectFingerprint } from "../../project-generator.mjs";
import { authorizeJob } from "../../security.mjs";

async function ensureTables() {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS sandbox_results (job_id TEXT PRIMARY KEY,version_id TEXT NOT NULL,status TEXT NOT NULL,stage TEXT NOT NULL,report_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS version_lineage (version_id TEXT PRIMARY KEY,parent_version_id TEXT,operation TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS compiled_artifacts (version_id TEXT PRIMARY KEY,job_id TEXT NOT NULL,object_key TEXT NOT NULL,bytes INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
}
function outputText(payload: any) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of payload.output || [])
    for (const content of item.content || [])
      if (content.type === "output_text") return content.text;
  return "";
}
function validateRepair(source: string) {
  const errors: string[] = [];
  if (!source.includes('from "phaser"') && !source.includes("from 'phaser'"))
    errors.push("Phaser import missing");
  if (/(?:fetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\/)/.test(source))
    errors.push("Network capability rejected");
  for (const match of source.matchAll(/from\s+["']([^"']+)["']/g))
    if (match[1] !== "phaser" && !match[1].startsWith("."))
      errors.push(`Import rejected: ${match[1]}`);
  if (source.length > 100000) errors.push("Repair too large");
  return errors;
}
function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
}
async function hydrateProjectAssets(project: any, jobId: string) {
  const copy = { ...project, files: { ...project.files }, binaryFiles: {} };
  const spec = JSON.parse(copy.files["game-spec.json"]),
    rows = await env.DB.prepare(
      "SELECT kind,object_key FROM generated_assets WHERE job_id=? ORDER BY created_at",
    )
      .bind(jobId)
      .all<{ kind: string; object_key: string }>(),
    bucket = (env as any).GAME_ASSETS;
  for (const row of rows.results || []) {
    const object = await bucket?.get(row.object_key);
    if (!object) continue;
    const bytes = new Uint8Array(await object.arrayBuffer()),
      path = `public/generated/${row.kind}.webp`;
    copy.binaryFiles[path] = encodeBase64(bytes);
    spec.art.generated = {
      ...(spec.art.generated || {}),
      [row.kind]: `/generated/${row.kind}.webp`,
    };
  }
  copy.files["game-spec.json"] = JSON.stringify(spec, null, 2);
  return copy;
}
async function runSandbox(
  url: string,
  key: string,
  jobId: string,
  project: any,
) {
  try {
    const response = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ jobId, project }),
        signal: AbortSignal.timeout(150000),
      }),
      data: any = await response.json();
    return response.ok
      ? data
      : { status: "failed", stage: data.stage || "sandbox", ...data };
  } catch (error) {
    return {
      status: "failed",
      stage: "transport",
      error: error instanceof Error ? error.message : "Sandbox unavailable",
    };
  }
}
async function repairProject(
  project: any,
  report: any,
  spec: any,
  apiKey: string,
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: (env as any).OPENAI_MODEL || "gpt-5.4-mini",
      reasoning: { effort: "medium" },
      input: [
        {
          role: "developer",
          content:
            "Repair only the supplied Phaser TypeScript entry file. Preserve the approved GameSpec and dependencies. Do not add network access, dynamic code execution, packages, URLs, or secrets. Return a complete replacement main.ts.",
        },
        {
          role: "user",
          content: `Approved GameSpec:\n${JSON.stringify(spec)}\nBuild failure:\n${JSON.stringify(report).slice(0, 12000)}\nCurrent main.ts:\n${project.files["src/main.ts"]}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "repair_patch",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              main_ts: { type: "string" },
              summary: { type: "string" },
            },
            required: ["main_ts", "summary"],
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`Repair model failed: ${response.status}`);
  const patch = JSON.parse(outputText(await response.json())),
    errors = validateRepair(patch.main_ts);
  if (errors.length) throw new Error(errors.join(", "));
  return {
    project: {
      ...project,
      files: { ...project.files, "src/main.ts": patch.main_ts },
    },
    summary: patch.summary,
  };
}

export async function POST(request: Request) {
  await ensureTables();
  const body = (await request.json()) as { jobId?: string },
    jobId = body.jobId || "";
  if (!jobId)
    return Response.json({ error: "Missing build id" }, { status: 400 });
  const access = await authorizeJob(request, jobId);
  if (!access.ok) return access.response;
  let version = await env.DB.prepare(
    "SELECT id,version,project_json FROM build_versions WHERE job_id=? ORDER BY version DESC LIMIT 1",
  )
    .bind(jobId)
    .first<{ id: string; version: number; project_json: string }>();
  const build = await env.DB.prepare(
    "SELECT spec_json FROM build_jobs WHERE id=?",
  )
    .bind(jobId)
    .first<{ spec_json: string }>();
  if (!version || !build)
    return Response.json(
      { error: "Project artifact not found" },
      { status: 404 },
    );
  const url = (env as any).SANDBOX_BUILD_URL || process.env.SANDBOX_BUILD_URL,
    key = (env as any).SANDBOX_API_KEY || process.env.SANDBOX_API_KEY,
    apiKey = (env as any).OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!url || !key)
    return Response.json(
      { error: "Linux sandbox is not configured", status: "pending" },
      { status: 503 },
    );
  let project = JSON.parse(version.project_json),
    report = await runSandbox(
      url,
      key,
      jobId,
      await hydrateProjectAssets(project, jobId),
    ),
    repairs: any[] = [];
  for (
    let attempt = 1;
    report.status !== "passed" && apiKey && attempt <= 2;
    attempt++
  ) {
    try {
      const repaired = await repairProject(
        project,
        report,
        JSON.parse(build.spec_json),
        apiKey,
      );
      project = repaired.project;
      const newId = crypto.randomUUID(),
        next = version.version + 1,
        fingerprint = projectFingerprint(project);
      await env.DB.prepare(
        "INSERT INTO build_versions (id,job_id,version,fingerprint,project_json) VALUES (?,?,?,?,?)",
      )
        .bind(newId, jobId, next, fingerprint, JSON.stringify(project))
        .run();
      await env.DB.prepare(
        "INSERT INTO version_lineage (version_id,parent_version_id,operation) VALUES (?,?,'repair')",
      )
        .bind(newId, version.id)
        .run();
      repairs.push({
        attempt,
        version: next,
        fingerprint,
        summary: repaired.summary,
      });
      version = {
        id: newId,
        version: next,
        project_json: JSON.stringify(project),
      };
      report = await runSandbox(
        url,
        key,
        jobId,
        await hydrateProjectAssets(project, jobId),
      );
    } catch (error) {
      repairs.push({
        attempt,
        error: error instanceof Error ? error.message : "Repair failed",
      });
      break;
    }
  }
  report = { ...report, repairs, repairAttempts: repairs.length };
  if (report.status === "passed") {
    const html = report.artifact?.html,
      bucket = (env as any).GAME_ASSETS;
    if (
      typeof html !== "string" ||
      !html.startsWith("<!doctype html") ||
      !bucket
    ) {
      report = {
        ...report,
        status: "failed",
        stage: "artifact-storage",
        error: "Compiled artifact could not be persisted",
      };
    } else {
      const objectKey = `compiled/${jobId}/${version.id}.html`,
        bytes = new TextEncoder().encode(html).byteLength;
      await bucket.put(objectKey, html, {
        httpMetadata: {
          contentType: "text/html; charset=utf-8",
          cacheControl: "private, max-age=31536000, immutable",
        },
        customMetadata: { jobId, versionId: version.id },
      });
      await env.DB.prepare(
        "INSERT INTO compiled_artifacts (version_id,job_id,object_key,bytes) VALUES (?,?,?,?) ON CONFLICT(version_id) DO UPDATE SET object_key=excluded.object_key,bytes=excluded.bytes,created_at=CURRENT_TIMESTAMP",
      )
        .bind(version.id, jobId, objectKey, bytes)
        .run();
      report = {
        ...report,
        artifact: {
          versionId: version.id,
          version: version.version,
          bytes,
          url: `/api/compiled?jobId=${encodeURIComponent(jobId)}&versionId=${encodeURIComponent(version.id)}`,
        },
      };
    }
  }
  await env.DB.prepare(
    "INSERT INTO sandbox_results (job_id,version_id,status,stage,report_json) VALUES (?,?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET version_id=excluded.version_id,status=excluded.status,stage=excluded.stage,report_json=excluded.report_json,created_at=CURRENT_TIMESTAMP",
  )
    .bind(
      jobId,
      version.id,
      report.status || "failed",
      report.stage || "unknown",
      JSON.stringify(report),
    )
    .run();
  return Response.json(report, {
    status: report.status === "passed" ? 200 : 422,
  });
}
export async function GET(request: Request) {
  await ensureTables();
  const jobId = new URL(request.url).searchParams.get("jobId") || "",
    access = await authorizeJob(request, jobId);
  if (!access.ok) return access.response;
  const row: any = await env.DB.prepare(
    "SELECT status,stage,report_json,created_at FROM sandbox_results WHERE job_id=?",
  )
    .bind(jobId)
    .first();
  return row
    ? Response.json({ ...row, report: JSON.parse(row.report_json) })
    : Response.json({ status: "pending" }, { status: 202 });
}
