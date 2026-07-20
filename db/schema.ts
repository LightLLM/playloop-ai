import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const games = sqliteTable("games", {
  id: text("id").primaryKey(),
  prompt: text("prompt").notNull(),
  playerX: real("player_x").notNull().default(48),
  playerY: real("player_y").notNull().default(64),
  specJson: text("spec_json"),
  progressJson: text("progress_json"),
  ownerId: text("owner_id"),
  shareToken: text("share_token"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});
export const buildJobs = sqliteTable("build_jobs", {
  id: text("id").primaryKey(),
  prompt: text("prompt").notNull(),
  status: text("status").notNull(),
  specJson: text("spec_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const buildEvents = sqliteTable("build_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: text("job_id").notNull(),
  agent: text("agent").notNull(),
  status: text("status").notNull(),
  summary: text("summary").notNull(),
  artifactJson: text("artifact_json"),
  traceId: text("trace_id"),
  elapsedMs: integer("elapsed_ms"),
  createdAt: text("created_at").notNull(),
});
export const buildVersions = sqliteTable("build_versions", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  version: integer("version").notNull(),
  fingerprint: text("fingerprint").notNull(),
  projectJson: text("project_json").notNull(),
  createdAt: text("created_at").notNull(),
});
export const generatedAssets = sqliteTable("generated_assets", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  kind: text("kind").notNull(),
  objectKey: text("object_key").notNull(),
  prompt: text("prompt").notNull(),
  model: text("model").notNull(),
  moderationStatus: text("moderation_status").notNull(),
  createdAt: text("created_at").notNull(),
});
export const versionLineage = sqliteTable("version_lineage", {
  versionId: text("version_id").primaryKey(),
  parentVersionId: text("parent_version_id"),
  operation: text("operation").notNull(),
  createdAt: text("created_at").notNull(),
});
export const publications = sqliteTable("publications", {
  slug: text("slug").primaryKey(),
  jobId: text("job_id").notNull(),
  versionId: text("version_id").notNull(),
  fingerprint: text("fingerprint").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const buildOwners = sqliteTable("build_owners", {
  jobId: text("job_id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  createdAt: text("created_at").notNull(),
});
export const quotaEvents = sqliteTable("quota_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  kind: text("kind").notNull(),
  windowKey: text("window_key").notNull(),
  createdAt: text("created_at").notNull(),
});
export const sandboxResults = sqliteTable("sandbox_results", {
  jobId: text("job_id").primaryKey(),
  versionId: text("version_id").notNull(),
  status: text("status").notNull(),
  stage: text("stage").notNull(),
  reportJson: text("report_json").notNull(),
  createdAt: text("created_at").notNull(),
});
export const compiledArtifacts = sqliteTable("compiled_artifacts", {
  versionId: text("version_id").primaryKey(),
  jobId: text("job_id").notNull(),
  objectKey: text("object_key").notNull(),
  bytes: integer("bytes").notNull(),
  createdAt: text("created_at").notNull(),
});
export const playerProgress = sqliteTable(
  "player_progress",
  {
    ownerId: text("owner_id").notNull(),
    gameId: text("game_id").notNull(),
    highScore: integer("high_score").notNull().default(0),
    lastState: text("last_state").notNull().default("playing"),
    achievementsJson: text("achievements_json").notNull().default("[]"),
    progressJson: text("progress_json").notNull().default("{}"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.gameId] }),
    index("player_progress_game_score_idx").on(table.gameId, table.highScore),
  ],
);
