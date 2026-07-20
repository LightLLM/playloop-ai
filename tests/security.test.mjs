import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const worker = await readFile(
    new URL("../worker/index.ts", import.meta.url),
    "utf8",
  ),
  security = await readFile(
    new URL("../app/security.mjs", import.meta.url),
    "utf8",
  ),
  assets = await readFile(
    new URL("../app/api/assets/route.ts", import.meta.url),
    "utf8",
  );
test("private build routes require trusted identity and ownership", () => {
  assert.match(worker, /oai-authenticated-user-email/);
  assert.match(worker, /SHA-256/);
  assert.match(worker, /authorizePrivateBuild/);
  assert.match(worker, /You do not own this build/);
  assert.match(worker, /Sign in required/);
  for (const route of ["api/versions", "api/preview", "api/build"])
    assert.match(worker, new RegExp(route.replace("/", "\\/")));
});
test("build and asset generation enforce durable daily quotas", () => {
  assert.match(worker, /Daily build quota reached/);
  assert.match(worker, /quota_events/);
  assert.match(worker, />=\s*10/);
  assert.match(worker, /ownerId === "local-development"/);
  assert.match(assets, /consumeQuota/);
  assert.match(assets, /Daily asset quota reached/);
  assert.match(assets, /retry-after/);
});
test("security helper permits local development without weakening deployed identity", () => {
  assert.match(security, /local-development/);
  assert.match(security, /hostname/);
  assert.match(security, /build_owners/);
  assert.match(security, /owner_id/);
});
