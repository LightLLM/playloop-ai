import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const page = await readFile(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);
const css = await readFile(
  new URL("../app/engine.css", import.meta.url),
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
test("Resonance Hollow RPG exposes quests, sound combat, and a skill tree", () => {
  for (const feature of [
    "function ResonanceRpg",
    "Bass Impact",
    "Echo Step",
    "Harmonic Shield",
    "CAST SOUND WAVE",
    "Mute King",
    "quest-complete",
  ]) assert.match(page, new RegExp(feature));
  assert.match(css, /\.resonance-skill-tree/);
  assert.match(css, /@keyframes resonance-pulse/);
});
test("runtime exposes prompt-driven adaptive soundtrack controls", () => {
  assert.match(page, /compileAudioPlan/);
  assert.match(page, /createProceduralAudioEngine/);
  assert.match(page, /deriveAudioCue/);
  assert.match(page, /ENABLE SOUND/);
  assert.match(css, /\.game-audio-bar/);
});
test("card fallback has a dedicated playable adapter", () => {
  assert.match(page, /function CardGame/);
  assert.match(page, /spec\.template\s*===\s*"card"/);
  assert.match(page, /game\s*=\s*<CardGame/);
  assert.match(page, /CHRONOVORE/);
});
test("narrative fallback has a dedicated branching adapter", () => {
  assert.match(page, /function NarrativeGame/);
  assert.match(page, /spec\.template\s*===\s*"narrative"/);
  assert.match(page, /game\s*=\s*<NarrativeGame/);
  assert.match(page, /dialogue-choices/);
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

test("finished preview waits for artwork and isolated QA terminal results", () => {
  assert.match(page, /ARTWORK · \{assetStatus\.toUpperCase\(\)\}/);
  assert.match(page, /PLAYABILITY QA · \{sandboxStatus\.toUpperCase\(\)\}/);
  assert.match(page, /setSandboxStatus\(response\.ok \? "passed"/);
  assert.match(page, /setStep\("ready"\)/);
  assert.doesNotMatch(
    page,
    /if \(event\.artifact\.build\) setBuildArtifact\(event\.artifact\.build\);\s*setTimeout\(\(\) => setStep\("ready"\)/,
  );
});

test("prompt-generated hero art replaces the top-down fallback character", () => {
  assert.match(page, /has-generated-hero/);
  assert.match(css, /\.world-player \.engine-sprite\.hero/);
});
test("tank battle renders enriched teams, terrain, and firing feedback", () => {
  for (const feature of [
    "Red enemy tank",
    "Green player tank",
    "tank-tracks",
    "tank-turret",
    "battlefield-crater",
    "battlefield-sandbags",
    "muzzle-flash",
  ])
    assert.match(page, new RegExp(feature));
  for (const feature of [
    ".enemy-tank .tank-hull",
    ".battlefield-road",
    ".tank.is-firing .muzzle-flash",
  ])
    assert.match(css, new RegExp(feature.replaceAll(".", "\\.")));
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
