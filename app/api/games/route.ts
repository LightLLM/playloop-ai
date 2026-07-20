import { env } from "cloudflare:workers";
import { actorFor } from "../../security.mjs";

type GameRow = {
  id: string;
  owner_id: string;
  share_token: string;
  prompt: string;
  player_x: number;
  player_y: number;
  spec_json: string | null;
  progress_json: string | null;
};

async function ensureTable() {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    player_x REAL NOT NULL DEFAULT 48,
    player_y REAL NOT NULL DEFAULT 64,
    spec_json TEXT,
    progress_json TEXT,
    owner_id TEXT,
    share_token TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  ).run();
  await env.DB.prepare("ALTER TABLE games ADD COLUMN spec_json TEXT")
    .run()
    .catch(() => undefined);
  await env.DB.prepare("ALTER TABLE games ADD COLUMN progress_json TEXT")
    .run()
    .catch(() => undefined);
  await env.DB.prepare("ALTER TABLE games ADD COLUMN owner_id TEXT")
    .run()
    .catch(() => undefined);
  await env.DB.prepare("ALTER TABLE games ADD COLUMN share_token TEXT")
    .run()
    .catch(() => undefined);
}

export async function GET(request: Request) {
  await ensureTable();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing game id" }, { status: 400 });
  const shareToken = new URL(request.url).searchParams.get("share"),
    actor = await actorFor(request);
  const row = await env.DB.prepare(
    "SELECT id, owner_id, share_token, prompt, player_x, player_y, spec_json, progress_json FROM games WHERE id = ?",
  )
    .bind(id)
    .first<GameRow>();
  if (!row) return Response.json({ error: "Game not found" }, { status: 404 });
  const owned =
      !!actor &&
      (row.owner_id === actor.ownerId ||
        (!row.owner_id && actor.ownerId === "local-development")),
    shared = !!shareToken && row.share_token === shareToken;
  if (!owned && !shared)
    return Response.json(
      { error: actor ? "You do not own this game" : "Sign in required" },
      { status: actor ? 403 : 401 },
    );
  return Response.json({
    id: row.id,
    prompt: row.prompt,
    player: { x: row.player_x, y: row.player_y },
    spec: row.spec_json ? JSON.parse(row.spec_json) : null,
    progress: row.progress_json ? JSON.parse(row.progress_json) : null,
    readOnly: !owned,
    shareToken: owned ? row.share_token : undefined,
  });
}

export async function POST(request: Request) {
  await ensureTable();
  const body = (await request.json()) as {
    id?: string;
    prompt?: string;
    player?: { x?: number; y?: number };
    spec?: unknown;
    progress?: unknown;
  };
  const prompt = body.prompt?.trim();
  if (!prompt || prompt.length < 10)
    return Response.json(
      { error: "A game prompt is required" },
      { status: 400 },
    );
  const actor = await actorFor(request);
  if (!actor)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  const id = body.id || crypto.randomUUID().slice(0, 12);
  const existing = await env.DB.prepare(
    "SELECT owner_id,share_token FROM games WHERE id=?",
  )
    .bind(id)
    .first<{ owner_id: string | null; share_token: string | null }>();
  if (existing?.owner_id && existing.owner_id !== actor.ownerId)
    return Response.json(
      { error: "You do not own this game" },
      { status: 403 },
    );
  const shareToken =
    existing?.share_token || crypto.randomUUID().replaceAll("-", "");
  const x = Math.max(0, Math.min(100, Number(body.player?.x ?? 48)));
  const y = Math.max(0, Math.min(100, Number(body.player?.y ?? 64)));
  const specJson = body.spec ? JSON.stringify(body.spec) : null;
  const progressJson = body.progress ? JSON.stringify(body.progress) : null;
  await env.DB.prepare(
    "INSERT INTO games (id, prompt, player_x, player_y, spec_json, progress_json, owner_id, share_token, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET prompt = excluded.prompt, player_x = excluded.player_x, player_y = excluded.player_y, spec_json = excluded.spec_json, progress_json = excluded.progress_json, owner_id = excluded.owner_id, share_token = excluded.share_token, updated_at = CURRENT_TIMESTAMP",
  )
    .bind(id, prompt, x, y, specJson, progressJson, actor.ownerId, shareToken)
    .run();
  return Response.json({
    id,
    prompt,
    player: { x, y },
    spec: body.spec,
    progress: body.progress,
    shareToken,
  });
}
