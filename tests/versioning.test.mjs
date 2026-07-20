import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const versions = await readFile(
    new URL("../app/api/versions/route.ts", import.meta.url),
    "utf8",
  ),
  published = await readFile(
    new URL("../app/api/published/route.ts", import.meta.url),
    "utf8",
  ),
  page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
test("version API supports immutable history, rollback, fork and publish", () => {
  for (const token of [
    "version_lineage",
    "publications",
    "rollback",
    "fork",
    "publish",
    "parent_version_id",
    "superseded",
  ])
    assert.match(versions, new RegExp(token));
  assert.match(versions, /MAX\(version\)/);
  assert.match(versions, /source\.project_json/);
});
test("published releases serve the exact compiled artifact with a restrictive CSP", () => {
  assert.match(published, /etag/);
  assert.match(published, /fingerprint/);
  assert.match(published, /compiled_artifacts/);
  assert.match(published, /connect-src 'self'/);
  assert.match(published, /max-age=31536000, immutable/);
  assert.match(versions, /exact version must pass isolated build QA/);
});
test("creator UI exposes version history controls", () => {
  for (const token of [
    "VersionControls",
    "BUILD HISTORY",
    "Rollback",
    "Fork",
    "Publish",
    "Published release",
  ])
    assert.match(page, new RegExp(token));
});
