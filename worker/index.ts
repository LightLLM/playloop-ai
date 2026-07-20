/** Cloudflare Worker entry point for the vinext-starter template. */
import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

async function ownerIdFor(request: Request) {
  const email = request.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLowerCase();
  if (email) {
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(email),
    );
    return Array.from(new Uint8Array(hash))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
  }
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1"
    ? "local-development"
    : null;
}
async function enforceBuildQuota(request: Request, db: D1Database) {
  const ownerId = await ownerIdFor(request);
  if (!ownerId)
    return {
      response: Response.json({ error: "Sign in required" }, { status: 401 }),
      ownerId: null,
    };
  if (ownerId === "local-development") return { response: null, ownerId };
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS quota_events (id INTEGER PRIMARY KEY AUTOINCREMENT,owner_id TEXT NOT NULL,kind TEXT NOT NULL,window_key TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    )
    .run();
  const windowKey = new Date().toISOString().slice(0, 10),
    row = await db
      .prepare(
        "SELECT COUNT(*) AS total FROM quota_events WHERE owner_id=? AND kind='build' AND window_key=?",
      )
      .bind(ownerId, windowKey)
      .first<{ total: number }>();
  if (Number(row?.total || 0) >= 10)
    return {
      response: Response.json(
        { error: "Daily build quota reached" },
        { status: 429, headers: { "retry-after": "3600" } },
      ),
      ownerId,
    };
  await db
    .prepare(
      "INSERT INTO quota_events (owner_id,kind,window_key) VALUES (?,'build',?)",
    )
    .bind(ownerId, windowKey)
    .run();
  return { response: null, ownerId };
}
async function authorizePrivateBuild(
  request: Request,
  db: D1Database,
  jobId: string | null,
) {
  if (!jobId)
    return Response.json({ error: "Missing build id" }, { status: 400 });
  const ownerId = await ownerIdFor(request);
  if (!ownerId)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS build_owners (job_id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    )
    .run();
  const row = await db
    .prepare("SELECT owner_id FROM build_owners WHERE job_id=?")
    .bind(jobId)
    .first<{ owner_id: string }>();
  if (!row && ownerId === "local-development") return null;
  if (row?.owner_id !== ownerId)
    return Response.json(
      { error: "You do not own this build" },
      { status: 403 },
    );
  return null;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/build" && request.method === "POST") {
      const gate = await enforceBuildQuota(request, env.DB);
      if (gate.response) return gate.response;
      const response = await handler.fetch(request, env, ctx),
        jobId = response.headers.get("x-build-job-id");
      if (jobId && gate.ownerId) {
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS build_owners (job_id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
        ).run();
        await env.DB.prepare(
          "INSERT OR REPLACE INTO build_owners (job_id,owner_id) VALUES (?,?)",
        )
          .bind(jobId, gate.ownerId)
          .run();
      }
      return response;
    }
    if (
      url.pathname === "/api/versions" ||
      url.pathname === "/api/preview" ||
      (url.pathname === "/api/build" && request.method === "GET")
    ) {
      let jobId = url.searchParams.get("jobId") || url.searchParams.get("id");
      if (request.method === "POST") {
        const body = (await request
          .clone()
          .json()
          .catch(() => ({}))) as { jobId?: string };
        jobId = body.jobId || null;
      }
      const denied = await authorizePrivateBuild(request, env.DB, jobId);
      if (denied) return denied;
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(
        request,
        {
          fetchAsset: (path) =>
            env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
      );
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
