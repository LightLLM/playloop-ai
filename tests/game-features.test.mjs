import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const page = await readFile(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);
const api = await readFile(
  new URL("../app/api/games/route.ts", import.meta.url),
  "utf8",
);
test("runtime dispatches all GameSpec templates", () => {
  for (const name of ["TopDown", "Platformer", "Puzzle"])
    assert.match(page, new RegExp(`function ${name}`));
  assert.match(page, /spec\.template\s*===\s*"platformer"/);
  assert.match(page, /spec\.template\s*===\s*"puzzle"/);
});
test("prompt preserves spaces and supports template override", () => {
  assert.match(page, /setPrompt\(e\.currentTarget\.value\)/);
  assert.match(page, /Auto-detect/);
  assert.doesNotMatch(page, /setPrompt\([^)]*\.replace\(/);
});
test("complete specs and runtime progress are persisted", () => {
  assert.match(api, /spec_json/);
  assert.match(api, /progress_json/);
  assert.match(page, /JSON\.stringify\(/);
  assert.match(page, /progress:\s*playState/);
});
test("action runtimes support keyboard and touch controls", () => {
  assert.match(page, /addEventListener\("keydown"/);
  assert.match(page, /ArrowUp/);
  assert.match(page, /onClick=\{\(\)\s*=>\s*move/);
});
test("platform levels include scrolling, combat, hazards and checkpoints", () => {
  for (const feature of [
    "level-stage",
    "level-enemy",
    "spikes",
    "checkpoint",
    "attack-control",
    "level-hud",
  ])
    assert.match(page, new RegExp(feature));
  assert.match(page, /worldWidth/);
  assert.match(page, /defeated/);
});
test("runtime dispatches advanced popular genres", () => {
  for (const feature of [
    "function Metroidvania",
    "function Roguelike",
    "function Shooter",
    "ability-gate",
    "dungeon-grid",
    "shooter-boss",
  ])
    assert.match(page, new RegExp(feature));
  for (const template of ["metroidvania", "roguelike", "shooter"])
    assert.match(page, new RegExp(`spec\\.template\\s*===\\s*"${template}"`));
});
test("RPG fallback has a dedicated playable adapter", () => {
  assert.match(page, /function RpgGame/);
  assert.match(page, /spec\.template\s*===\s*"rpg"/);
  assert.match(page, /game\s*=\s*<RpgGame/);
});
test("build screen exposes agent execution beside live preview", () => {
  for (const feature of [
    "AgentBuildWorkspace",
    "Director Agent",
    "GameSpec Agent",
    "Level Agent",
    "Art Agent",
    "Physics Agent",
    "QA Agent",
    "Supervisor Agent",
    "GAME PREVIEW",
  ])
    assert.match(page, new RegExp(feature));
});
test("creator approves a structured plan before the build starts", () => {
  for (const feature of [
    "PLAN AWAITING APPROVAL",
    "Approve & build",
    "Revise prompt",
    "preparePlan",
    "gameLoop.actions",
    "progression.levels",
  ])
    assert.match(page, new RegExp(feature));
});
