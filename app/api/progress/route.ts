import { env } from "cloudflare:workers";
import { actorFor } from "../../security.mjs";

async function ensureTables() {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS player_progress (
      owner_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      high_score INTEGER NOT NULL DEFAULT 0,
      last_state TEXT NOT NULL DEFAULT 'playing',
      achievements_json TEXT NOT NULL DEFAULT '[]',
      progress_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (owner_id, game_id)
    )`,
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS player_progress_game_score_idx ON player_progress(game_id, high_score)",
  ).run();
}

function safeAchievements(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v) => typeof v === "string").slice(0, 50))];
}

export async function GET(request: Request) {
  const actor = await actorFor(request);
  if (!actor)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  await ensureTables();
  const gameId = new URL(request.url).searchParams.get("gameId");
  if (!gameId)
    return Response.json({ error: "Missing game id" }, { status: 400 });
  if (new URL(request.url).searchParams.get("leaderboard") === "1") {
    const owned = await env.DB.prepare(
      "SELECT id FROM games WHERE id=? AND owner_id=?",
    )
      .bind(gameId, actor.ownerId)
      .first();
    if (!owned)
      return Response.json({ error: "Game not found" }, { status: 404 });
    const rows = await env.DB.prepare(
      "SELECT high_score,updated_at FROM player_progress WHERE game_id=? ORDER BY high_score DESC,updated_at ASC LIMIT 20",
    )
      .bind(gameId)
      .all<any>();
    return Response.json({
      leaderboard: (rows.results || []).map((row: any, index: number) => ({
        rank: index + 1,
        highScore: row.high_score,
        updatedAt: row.updated_at,
      })),
    });
  }
  const row = await env.DB.prepare(
    "SELECT high_score,last_state,achievements_json,progress_json,updated_at FROM player_progress WHERE owner_id=? AND game_id=?",
  )
    .bind(actor.ownerId, gameId)
    .first<any>();
  return Response.json(
    row
      ? {
          highScore: row.high_score,
          lastState: row.last_state,
          achievements: JSON.parse(row.achievements_json),
          progress: JSON.parse(row.progress_json),
          updatedAt: row.updated_at,
        }
      : { highScore: 0, lastState: "playing", achievements: [], progress: {} },
  );
}

export async function POST(request: Request) {
  const actor = await actorFor(request);
  if (!actor)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  await ensureTables();
  const body = (await request.json()) as any;
  const gameId = typeof body.gameId === "string" ? body.gameId : "";
  if (!gameId)
    return Response.json({ error: "Missing game id" }, { status: 400 });
  const owned = await env.DB.prepare(
    "SELECT id FROM games WHERE id=? AND owner_id=?",
  )
    .bind(gameId, actor.ownerId)
    .first();
  if (!owned)
    return Response.json({ error: "Game not found" }, { status: 404 });
  const score = Math.max(
    0,
    Math.min(1_000_000_000, Math.floor(Number(body.score) || 0)),
  );
  const state = ["playing", "victory", "failure", "restarted"].includes(
    body.lastState,
  )
    ? body.lastState
    : "playing";
  const achievements = safeAchievements(body.achievements);
  const progress =
    body.progress && typeof body.progress === "object" ? body.progress : {};
  await env.DB.prepare(
    `INSERT INTO player_progress (owner_id,game_id,high_score,last_state,achievements_json,progress_json,updated_at)
     VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)
     ON CONFLICT(owner_id,game_id) DO UPDATE SET
       high_score=MAX(player_progress.high_score,excluded.high_score),
       last_state=excluded.last_state,
       achievements_json=excluded.achievements_json,
       progress_json=excluded.progress_json,
       updated_at=CURRENT_TIMESTAMP`,
  )
    .bind(
      actor.ownerId,
      gameId,
      score,
      state,
      JSON.stringify(achievements),
      JSON.stringify(progress),
    )
    .run();
  return Response.json({ saved: true, highScore: score, achievements });
}
