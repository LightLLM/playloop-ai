import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileGameSpec } from "../app/game-engine.mjs";

const route = await readFile(
  new URL("../app/api/compile/route.ts", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);

test("AI compiler uses server-side Responses API structured output", () => {
  assert.match(route, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(route, /type: "json_schema"/);
  assert.match(route, /strict: true/);
  assert.doesNotMatch(page, /OPENAI_API_KEY/);
});

test("compiler keeps a validated deterministic fallback", () => {
  assert.match(route, /compiler: "deterministic"/);
  assert.match(route, /validateGameSpec\(spec\)/);
  assert.match(page, /Recovered with validated local compiler/);
});

test("every local GameSpec contains a cohesive art production manifest", () => {
  const spec = compileGameSpec(
    "A moon fox explores a mysterious space station",
  );
  assert.match(spec.art.manifest.environment, /pixel art/);
  assert.match(spec.art.manifest.hero, /transparent background/);
  assert.match(spec.art.manifest.props, /sprite sheet/);
});
