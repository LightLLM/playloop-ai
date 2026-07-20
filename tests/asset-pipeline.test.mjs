import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const route = await readFile(
    new URL("../app/api/assets/route.ts", import.meta.url),
    "utf8",
  ),
  hosting = JSON.parse(
    await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  );
test("generated art is moderated, produced server-side, and stored in R2", () => {
  assert.equal(hosting.r2, "GAME_ASSETS");
  assert.match(route, /omni-moderation-latest/);
  assert.match(route, /gpt-image-1\.5/);
  assert.match(route, /OPENAI_API_KEY/);
  assert.match(route, /bucket\.put/);
  assert.match(route, /generated_assets/);
});
test("asset delivery is immutable and restricted to known manifest kinds", () => {
  assert.match(route, /allowedKinds/);
  assert.match(route, /environment/);
  assert.match(route, /hero/);
  assert.match(route, /props/);
  assert.match(route, /max-age=31536000, immutable/);
  assert.match(route, /x-content-type-options/);
});
