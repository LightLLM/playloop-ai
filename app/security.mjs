import { env } from "cloudflare:workers";

export async function actorFor(request) {
  const email = request.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLowerCase();
  if (email) return { ownerId: await digest(email), authenticated: true };
  const host = new URL(request.url).hostname;
  if (host === "localhost" || host === "127.0.0.1")
    return { ownerId: "local-development", authenticated: false };
  return null;
}
async function digest(value) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export async function ensureSecurityTables() {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS build_owners (job_id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS quota_events (id INTEGER PRIMARY KEY AUTOINCREMENT,owner_id TEXT NOT NULL,kind TEXT NOT NULL,window_key TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
}
export async function authorizeJob(request, jobId) {
  await ensureSecurityTables();
  const actor = await actorFor(request);
  if (!actor)
    return {
      ok: false,
      response: Response.json({ error: "Sign in required" }, { status: 401 }),
    };
  const owner = await env.DB.prepare(
    "SELECT owner_id FROM build_owners WHERE job_id=?",
  )
    .bind(jobId)
    .first();
  if (!owner && actor.ownerId === "local-development")
    return { ok: true, actor };
  if (owner?.owner_id !== actor.ownerId)
    return {
      ok: false,
      response: Response.json(
        { error: "You do not own this build" },
        { status: 403 },
      ),
    };
  return { ok: true, actor };
}
export async function consumeQuota(ownerId, kind, limit) {
  if (ownerId === "local-development") return { ok: true };
  await ensureSecurityTables();
  const windowKey = new Date().toISOString().slice(0, 10),
    row = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM quota_events WHERE owner_id=? AND kind=? AND window_key=?",
    )
      .bind(ownerId, kind, windowKey)
      .first();
  if (Number(row?.total || 0) >= limit)
    return { ok: false, retryAfter: secondsUntilTomorrow() };
  await env.DB.prepare(
    "INSERT INTO quota_events (owner_id,kind,window_key) VALUES (?,?,?)",
  )
    .bind(ownerId, kind, windowKey)
    .run();
  return { ok: true };
}
function secondsUntilTomorrow() {
  const now = new Date(),
    next = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );
  return Math.ceil((next.getTime() - now.getTime()) / 1000);
}
