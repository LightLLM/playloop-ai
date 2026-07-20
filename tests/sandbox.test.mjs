import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const worker = await readFile(
    new URL("../sandbox-worker/index.ts", import.meta.url),
    "utf8",
  ),
  config = await readFile(
    new URL("../sandbox-worker/wrangler.jsonc", import.meta.url),
    "utf8",
  ),
  route = await readFile(
    new URL("../app/api/sandbox-build/route.ts", import.meta.url),
    "utf8",
  );
test("Linux sandbox compiles generated projects in disposable isolated containers", () => {
  for (const token of [
    "getSandbox",
    "npm install --ignore-scripts",
    "npm run build",
    "max-old-space-size=512",
    "sandbox.destroy",
    "readFile",
    "artifact",
  ])
    assert.match(
      worker,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  assert.match(worker, /transport:\s*"rpc"/);
  assert.match(worker, /timeout:\s*120000/);
  assert.match(config, /containers/);
  assert.match(config, /durable_objects/);
  assert.match(config, /instance_type/);
});
test("sandbox enforces authentication, path safety and dependency allowlists", () => {
  assert.match(worker, /SANDBOX_API_KEY/);
  assert.match(worker, /allowedDependencies/);
  assert.match(worker, /allowedDevDependencies/);
  assert.match(worker, /Unsafe path/);
  assert.match(worker, /Dependency not allowed/);
  assert.match(worker, /noSecretsInjected/);
});
test("main app submits private version artifacts and persists sandbox reports", () => {
  assert.match(route, /authorizeJob/);
  assert.match(route, /SANDBOX_BUILD_URL/);
  assert.match(route, /AbortSignal\.timeout\(150000\)/);
  assert.match(route, /sandbox_results/);
  assert.match(route, /project_json/);
});
test("failed sandbox builds receive constrained AI repair and are rerun", () => {
  for (const token of [
    "repairProject",
    "repair_patch",
    "validateRepair",
    "Network capability rejected",
    "version_lineage",
    "'repair'",
    "runSandbox",
  ])
    assert.match(
      route,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  assert.match(route, /attempt\s*<=\s*2/);
  assert.match(route, /OPENAI_API_KEY/);
  assert.match(route, /projectFingerprint/);
});
