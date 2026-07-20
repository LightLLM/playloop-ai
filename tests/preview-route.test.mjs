import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const route = await readFile(
  new URL("../app/api/preview/route.ts", import.meta.url),
  "utf8",
);
test("preview endpoint enforces CSP and immutable delivery", () => {
  assert.match(route, /content-security-policy/);
  assert.match(route, /connect-src 'none'/);
  assert.match(route, /frame-ancestors 'self'/);
  assert.match(route, /max-age=31536000, immutable/);
  assert.match(route, /validatePreviewArtifact/);
});
