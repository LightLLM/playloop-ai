import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const route = await readFile(
  new URL("../app/api/build/route.ts", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);
test("build orchestration streams persisted auditable events", () => {
  assert.match(route, /text\/event-stream/);
  assert.match(route, /INSERT INTO build_events/);
  assert.match(route, /ReadableStream/);
  assert.match(page, /response\.body\.getReader/);
});
test("artifact handoffs cover specialized agents and QA repair", () => {
  for (const agent of [
    "Director Agent",
    "GameSpec Agent",
    "Level Agent",
    "Art Agent",
    "Physics Agent",
    "QA Agent",
    "Repair Agent",
  ])
    assert.match(route, new RegExp(agent));
  assert.match(route, /validateGameSpec/);
  assert.match(route, /Recompiled and revalidated/);
});
test("client renders streamed summaries rather than hidden reasoning", () => {
  assert.match(page, /SERVER ORCHESTRATION \/ AUDIT LOG/);
  assert.match(page, /VERIFIABLE OUTPUT/);
  assert.match(page, /setBuildEvents/);
  assert.doesNotMatch(page, /chain.of.thought/i);
});
test("build pipeline versions and exports immutable Phaser artifacts", () => {
  for (const feature of [
    "generateProject",
    "projectFingerprint",
    "build_versions",
    "content-disposition",
    "immutable",
  ])
    assert.match(route, new RegExp(feature));
  assert.match(page, /Download Phaser ZIP/);
});
test("completed builds run in a restricted iframe with a health handshake", () => {
  for (const feature of [
    "SandboxedPreview",
    'sandbox="allow-scripts"',
    "playloop-preview",
    "RUNTIME HEALTHY",
  ])
    assert.match(page, new RegExp(feature));
  assert.match(route, /validatePreviewArtifact/);
  assert.match(route, /preview:/);
});
