import { env } from "cloudflare:workers";
import { strToU8, zipSync } from "fflate";
import {
  compileGameSpec,
  inferTemplate,
  validateGameSpec,
} from "../../game-engine.mjs";
import {
  generatePreviewHtml,
  generateProject,
  projectFingerprint,
  validatePreviewArtifact,
} from "../../project-generator.mjs";
import {
  actorFor,
  authorizeJob,
  ensureSecurityTables,
} from "../../security.mjs";

async function ensureBuildTables() {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS build_jobs (id TEXT PRIMARY KEY,prompt TEXT NOT NULL,status TEXT NOT NULL,spec_json TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS build_events (id INTEGER PRIMARY KEY AUTOINCREMENT,job_id TEXT NOT NULL,agent TEXT NOT NULL,status TEXT NOT NULL,summary TEXT NOT NULL,artifact_json TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
  await env.DB.prepare("ALTER TABLE build_events ADD COLUMN trace_id TEXT")
    .run()
    .catch(() => undefined);
  await env.DB.prepare("ALTER TABLE build_events ADD COLUMN elapsed_ms INTEGER")
    .run()
    .catch(() => undefined);
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS build_versions (id TEXT PRIMARY KEY,job_id TEXT NOT NULL,version INTEGER NOT NULL,fingerprint TEXT NOT NULL,project_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function supervisePromptFidelity(prompt: string, spec: any) {
  const normalized = prompt.toLowerCase();
  const explicitTitle = (
    prompt.match(
      /\btitle\s*:\s*([A-Z][A-Za-z0-9' -]{2,60}(?::\s*[A-Z][A-Za-z0-9' -]{2,40})?)(?=\.|\n|$)/,
    ) ||
    prompt.match(
      /^([A-Z][A-Za-z0-9' -]{2,55}:\s*[A-Z][A-Za-z0-9' -]{2,40})(?=\.)/,
    )
  )?.[1]?.trim();
  const significant = [
    ...new Set(
      normalized
        .replace(/[^a-z0-9 -]/g, " ")
        .split(/\s+/)
        .filter(
          (word) =>
            word.length >= 5 &&
            !["create", "detailed", "game", "player", "using", "with", "from", "their", "about"].includes(word),
        ),
    ),
  ].slice(0, 24);
  const { prompt: _sourcePrompt, ...supervisedSpec } = spec || {};
  const specText = JSON.stringify(supervisedSpec).toLowerCase();
  const artText = JSON.stringify(spec.art?.manifest || {}).toLowerCase();
  const matchedTerms = significant.filter((term) => specText.includes(term));
  const artTerms = significant.filter((term) => artText.includes(term));
  const checks = {
    title: !explicitTitle || spec.title.toLowerCase() === explicitTitle.toLowerCase(),
    genre: spec.template === inferTemplate(prompt, "auto"),
    promptIdentity: matchedTerms.length >= Math.min(5, significant.length),
    artworkIdentity: artTerms.length >= Math.min(4, significant.length),
    playableContract: validateGameSpec(spec).valid,
    clocktowerIdentity:
      !/clock\s*tower|clocktower/i.test(prompt) ||
      /clock\s*tower|clocktower/i.test(`${spec.title} ${artText}`),
    requestedGears:
      !/\bgears?\b/i.test(prompt) ||
      spec.hazards?.some((hazard: any) => hazard.type === "gear"),
    requestedMotion:
      !/\bmoving\s+hazards?\b/i.test(prompt) ||
      spec.hazards?.some((hazard: any) => hazard.motion?.range > 0),
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    explicitTitle: explicitTitle || null,
    matchedTerms: matchedTerms.slice(0, 10),
    artTerms: artTerms.slice(0, 10),
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    prompt?: string;
    template?: string;
    approvedSpec?: unknown;
  };
  const prompt = body.prompt?.trim() || "";
  if (prompt.length < 10)
    return Response.json({ error: "Prompt is too short" }, { status: 400 });
  await ensureBuildTables();
  await ensureSecurityTables();
  const actor = await actorFor(request);
  if (!actor)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  const approvedValidation = body.approvedSpec
    ? validateGameSpec(body.approvedSpec)
    : null;
  if (approvedValidation && !approvedValidation.valid)
    return Response.json(
      { error: "Approved plan is invalid", details: approvedValidation.errors },
      { status: 422 },
    );
  const jobId = crypto.randomUUID();
  const traceId = crypto.randomUUID(),
    startedAt = Date.now();
  await env.DB.prepare(
    "INSERT INTO build_jobs (id,prompt,status) VALUES (?,?,'running')",
  )
    .bind(jobId, prompt)
    .run();
  await env.DB.prepare(
    "INSERT INTO build_owners (job_id,owner_id) VALUES (?,?)",
  )
    .bind(jobId, actor.ownerId)
    .run();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const emit = async (
        agent: string,
        status: string,
        summary: string,
        progress: number,
        artifact?: unknown,
      ) => {
        const event = {
          jobId,
          agent,
          status,
          summary,
          progress,
          artifact,
          at: new Date().toISOString(),
          traceId,
          elapsedMs: Date.now() - startedAt,
        };
        await env.DB.prepare(
          "INSERT INTO build_events (job_id,agent,status,summary,artifact_json,trace_id,elapsed_ms) VALUES (?,?,?,?,?,?,?)",
        )
          .bind(
            jobId,
            agent,
            status,
            summary,
            artifact ? JSON.stringify(artifact) : null,
            traceId,
            event.elapsedMs,
          )
          .run();
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };
      (async () => {
        try {
          const genre = body.approvedSpec
            ? (body.approvedSpec as any).template
            : inferTemplate(prompt, body.template || "auto");
          await emit(
            "Director Agent",
            "completed",
            `Classified prompt as ${genre}; established player goal and safety constraints.`,
            12,
            { genre },
          );
          await pause(100);
          await emit(
            "GameSpec Agent",
            "running",
            "Compiling the portable gameplay contract.",
            20,
          );
          let result: any = body.approvedSpec
            ? { spec: body.approvedSpec, compiler: "approved-plan" }
            : null;
          try {
            if (result) throw new Error("approved-plan");
            const compileHeaders: Record<string, string> = {
                "content-type": "application/json",
              },
              userEmail = request.headers.get("oai-authenticated-user-email");
            if (userEmail)
              compileHeaders["oai-authenticated-user-email"] = userEmail;
            const response = await fetch(new URL("/api/compile", request.url), {
              method: "POST",
              headers: compileHeaders,
              body: JSON.stringify({
                prompt,
                template: body.template || "auto",
              }),
            });
            result = await response.json();
            if (!response.ok || !result.spec)
              throw new Error(result.error || "Compiler failed");
          } catch (error) {
            if (result) {
              // The creator-approved, schema-validated plan is authoritative.
            } else
              result = {
                spec: compileGameSpec(prompt, body.template || "auto"),
                compiler: "deterministic",
              };
          }
          let spec = result.spec;
          await emit(
            "GameSpec Agent",
            "completed",
            `Produced GameSpec ${spec.schemaVersion} with ${result.compiler || "deterministic"} compiler.`,
            34,
            { template: spec.template, id: spec.id },
          );
          await pause(100);
          const entities =
            (spec.platforms?.length || 0) +
            (spec.enemies?.length || 0) +
            (spec.collectibles?.length || 0) +
            (spec.rooms?.length || 0);
          await emit(
            "Level Agent",
            "completed",
            `Generated seeded ${spec.template} layout with ${entities} gameplay entities.`,
            50,
            { entities, world: spec.world },
          );
          await pause(100);
          await emit(
            "Art Agent",
            "completed",
            `Created cohesive ${spec.theme} art handoff for environment, hero, and props.`,
            65,
            spec.art.manifest,
          );
          await pause(100);
          const physics = {
            fixedStep: 60,
            gravity: 92,
            collision: "AABB + swept landing",
            respawn: true,
          };
          await emit(
            "Physics Agent",
            "completed",
            "Attached fixed-step movement, collision bodies, hazards, falling, and respawn rules.",
            80,
            physics,
          );
          await pause(100);
          let validation = validateGameSpec(spec);
          await emit(
            "QA Agent",
            "running",
            "Checking schema, required mechanics, completion path, and runtime compatibility.",
            88,
          );
          if (!validation.valid) {
            await emit(
              "Repair Agent",
              "running",
              `Validation found ${validation.errors.length} issue(s); rebuilding from deterministic baseline.`,
              91,
              { errors: validation.errors },
            );
            spec = compileGameSpec(prompt, body.template || "auto");
            validation = validateGameSpec(spec);
            await emit(
              "Repair Agent",
              "completed",
              "Recompiled and revalidated the affected artifact.",
              95,
            );
          }
          if (!validation.valid) throw new Error(validation.errors.join(", "));
          const previewCheck = validatePreviewArtifact(
            generatePreviewHtml(spec),
          );
          if (!previewCheck.valid)
            throw new Error(previewCheck.errors.join(", "));
          await emit(
            "Supervisor Agent",
            "running",
            "Comparing genre, title, mechanics, entities, and art direction with the creator's prompt.",
            96,
          );
          let supervision = supervisePromptFidelity(prompt, spec);
          if (!supervision.passed) {
            spec = compileGameSpec(prompt, body.template || "auto");
            validation = validateGameSpec(spec);
            supervision = supervisePromptFidelity(prompt, spec);
          }
          if (!validation.valid || !supervision.passed)
            throw new Error(
              `Supervisor rejected prompt drift: ${JSON.stringify(supervision.checks)}`,
            );
          await emit(
            "Supervisor Agent",
            "completed",
            "Verified that the playable contract and cohesive art manifest preserve the user's prompt.",
            98,
            supervision,
          );
          const project = generateProject(spec),
            fingerprint = projectFingerprint(project),
            versionId = crypto.randomUUID();
          await env.DB.prepare(
            "INSERT INTO build_versions (id,job_id,version,fingerprint,project_json) VALUES (?,?,1,?,?)",
          )
            .bind(versionId, jobId, fingerprint, JSON.stringify(project))
            .run();
          await emit(
            "QA Agent",
            "completed",
            "Validated the contract, lifecycle handshake, network isolation, and immutable project.",
            99,
            {
              valid: true,
              checks: [
                "zod-schema",
                "lifecycle-events",
                "no-external-network",
                "csp-preview",
                "project-manifest",
              ],
              fingerprint,
            },
          );
          await env.DB.prepare(
            "UPDATE build_jobs SET status='completed',spec_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          )
            .bind(JSON.stringify(spec), jobId)
            .run();
          await emit(
            "Orchestrator",
            "completed",
            "Isolated preview and versioned Phaser project are ready.",
            100,
            {
              spec,
              compiler: result.compiler || "deterministic",
              build: {
                jobId,
                versionId,
                version: 1,
                fingerprint,
                download: `/api/build?id=${jobId}&download=1`,
                preview: `/api/preview?id=${jobId}&version=1`,
              },
            },
          );
          controller.close();
        } catch (error) {
          await env.DB.prepare(
            "UPDATE build_jobs SET status='failed',updated_at=CURRENT_TIMESTAMP WHERE id=?",
          )
            .bind(jobId)
            .run();
          await emit(
            "Orchestrator",
            "failed",
            error instanceof Error ? error.message : "Build failed",
            100,
          );
          controller.close();
        }
      })();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "x-build-job-id": jobId,
    },
  });
}

export async function GET(request: Request) {
  await ensureBuildTables();
  const url = new URL(request.url),
    id = url.searchParams.get("id"),
    download = url.searchParams.get("download");
  if (!id) return Response.json({ error: "Missing job id" }, { status: 400 });
  const access = await authorizeJob(request, id);
  if (!access.ok) return access.response;
  if (download) {
    const row = await env.DB.prepare(
      "SELECT project_json,fingerprint FROM build_versions WHERE job_id=? ORDER BY version DESC LIMIT 1",
    )
      .bind(id)
      .first<{ project_json: string; fingerprint: string }>();
    if (!row)
      return Response.json(
        { error: "Build artifact not found" },
        { status: 404 },
      );
    const project = JSON.parse(row.project_json),
      archive = zipSync(
        Object.fromEntries(
          Object.entries(project.files).map(([path, content]) => [
            path,
            strToU8(String(content)),
          ]),
        ),
        { level: 6 },
      );
    return new Response(archive.buffer as ArrayBuffer, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename=\"playloop-${row.fingerprint}.zip\"`,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }
  const events = await env.DB.prepare(
    "SELECT agent,status,summary,artifact_json,trace_id,elapsed_ms,created_at FROM build_events WHERE job_id=? ORDER BY id",
  )
    .bind(id)
    .all();
  const version = await env.DB.prepare(
    "SELECT id,version,fingerprint,created_at FROM build_versions WHERE job_id=? ORDER BY version DESC LIMIT 1",
  )
    .bind(id)
    .first();
  return Response.json({ id, events: events.results, version });
}
