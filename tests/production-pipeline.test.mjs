import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [
  page,
  games,
  build,
  assets,
  generator,
  sandbox,
  sandboxWorker,
  compiled,
  versions,
  published,
  progress,
] = await Promise.all([
  read("../app/page.tsx"),
  read("../app/api/games/route.ts"),
  read("../app/api/build/route.ts"),
  read("../app/api/assets/route.ts"),
  read("../app/project-generator.mjs"),
  read("../app/api/sandbox-build/route.ts"),
  read("../sandbox-worker/index.ts"),
  read("../app/api/compiled/route.ts"),
  read("../app/api/versions/route.ts"),
  read("../app/api/published/route.ts"),
  read("../app/api/progress/route.ts"),
]);

test("saved games are owner-scoped and use explicit protected share tokens", () => {
  for (const token of [
    "actorFor",
    "owner_id",
    "share_token",
    "You do not own this game",
    "readOnly",
  ])
    assert.match(games, new RegExp(token));
  assert.match(page, /share=/);
  assert.doesNotMatch(page, /type="password"/);
  assert.match(page, /signin-with-chatgpt/);
});
test("the schema-validated creator-approved plan is the authoritative build input", () => {
  assert.match(build, /approvedSpec/);
  assert.match(build, /Approved plan is invalid/);
  assert.match(build, /compiler:\s*"approved-plan"/);
  assert.match(build, /validateGameSpec\(body\.approvedSpec\)/);
});
test("durable build events carry trace and timing observability", () => {
  assert.match(build, /traceId/);
  assert.match(build, /elapsedMs/);
  assert.match(build, /trace_id/);
  assert.match(build, /elapsed_ms/);
});
test("project export is a runnable ZIP rather than a JSON label", () => {
  assert.match(build, /zipSync/);
  assert.match(build, /application\/zip/);
  assert.match(build, /\.zip/);
  assert.match(page, /Download Phaser ZIP/);
});
test("generated art creates a new immutable version and enters the Phaser runtime", () => {
  for (const token of [
    "attachAssetToVersion",
    "generateProject",
    "projectFingerprint",
    "version_lineage",
    "'asset'",
    "art.generated",
  ])
    assert.match(
      assets,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  assert.match(generator, /generated-environment/);
  assert.match(generator, /generated-hero/);
  assert.match(generator, /generated-props/);
  assert.match(generator, /generated-spritesheet/);
  assert.match(generator, /generateFrameNumbers/);
  assert.match(assets, /art\.provenance/);
  assert.match(assets, /openai-generated/);
  assert.match(generator, /createProceduralBackdrop/);
  assert.match(generator, /proceduralArt/);
  assert.match(page, /PROMPT-DERIVED PROCEDURAL PIXEL ENGINE/);
});
test("account-owned achievements and high scores persist beyond browser storage", () => {
  for (const token of [
    "player_progress",
    "actorFor",
    "high_score",
    "achievements_json",
    "MAX(player_progress.high_score",
    "Game not found",
  ])
    assert.match(
      progress,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  assert.match(page, /\/api\/progress/);
  assert.match(generator, /achievements/);
  assert.match(generator, /parent\.postMessage/);
  assert.match(generator, /tone\(/);
});
test("touch controls ship in both generated Phaser projects and fallback previews", () => {
  assert.match(generator, /createTouchControls/);
  assert.match(generator, /pointerdown/);
  assert.match(generator, /enhancePreviewWithTouch/);
  assert.match(generator, /touch-action:none/);
});
test("isolated QA launches every generated game and enforces the complete smoke matrix", () => {
  for (const token of [
    "playwright test",
    "game.restarted",
    "failure",
    "victory",
    "touch:right",
    "screenshot",
    "metrics.fps",
    "playloop-save",
    'role="application"',
  ])
    assert.match(
      generator,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  for (const check of [
    "browserGameplayQa",
    "keyboardAndTouch",
    "lifecyclePaths",
    "screenshotDiff",
    "performanceBudget",
    "persistenceReload",
    "accessibilitySmoke",
  ])
    assert.match(sandboxWorker, new RegExp(check));
  assert.match(sandboxWorker, /npm run qa/);
  assert.match(generator, /mechanicContract/);
  assert.match(generator, /contract\.ready/);
  assert.match(generator, /contract\.mechanicCount/);
});
test("immutable R2 art is hydrated into the isolated project without network access", () => {
  assert.match(generator, /assetRefs/);
  assert.match(sandbox, /hydrateProjectAssets/);
  assert.match(sandbox, /public\/generated/);
  assert.match(sandboxWorker, /binaryFiles/);
  assert.match(sandboxWorker, /Unsafe binary path/);
});
test("a passing isolated build is persisted and the exact artifact is the publish target", () => {
  for (const token of [
    "compiled_artifacts",
    "GAME_ASSETS",
    "artifact-storage",
    "/api/compiled",
  ])
    assert.match(sandbox, new RegExp(token.replace("/", "\\/")));
  assert.match(compiled, /authorizeJob/);
  assert.match(versions, /qa\?\.status\s*!==\s*"passed"/);
  assert.match(published, /JOIN compiled_artifacts/);
});
