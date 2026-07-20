import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("defines the focused game prompt experience", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /Describe your next/);
  assert.match(page, /Compile game/);
  assert.match(layout, /PlayLoop AI — Describe it\. Play it\./);
});
