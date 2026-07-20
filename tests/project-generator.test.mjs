import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";
import { compileGameSpec, validateGameSpec } from "../app/game-engine.mjs";
import {
  enhancePreviewWithGeneratedArt,
  generatePreviewHtml,
  generateProject,
  projectFingerprint,
  validatePreviewArtifact,
} from "../app/project-generator.mjs";

test("GameSpec includes the production planning contract", () => {
  const spec = compileGameSpec("A racing game through a neon city");
  assert.equal(validateGameSpec(spec).valid, true);
  assert.equal(spec.viewport.width, 960);
  assert.ok(spec.gameLoop.actions.length);
  assert.ok(spec.scenes.includes("results"));
  assert.ok(spec.testing.expectedStates.includes("restarted"));
  assert.equal(spec.persistence.saveProgress, true);
});
test("generator packages a deterministic immutable Phaser project", () => {
  const spec = compileGameSpec("A snake game in a magical forest"),
    a = generateProject(spec),
    b = generateProject(spec);
  assert.equal(a.engine, "phaser-3.90.0");
  assert.equal(a.immutable, true);
  assert.match(a.files["src/main.ts"], /import Phaser/);
  assert.match(a.files["game-spec.json"], /"template": "snake"/);
  assert.match(a.files["game-spec.json"], /"audioPlan"/);
  assert.match(a.files["src/main.ts"], /spec\.audioPlan/);
  assert.equal(projectFingerprint(a), projectFingerprint(b));
});
test("every genre emits syntactically valid Phaser and browser QA TypeScript", () => {
  const templates = [
    "top_down",
    "platformer",
    "metroidvania",
    "roguelike",
    "puzzle",
    "shooter",
    "snake",
    "falling_blocks",
    "tank",
    "tennis",
    "racing",
    "strategy",
    "rpg",
    "card",
    "simulation",
    "narrative",
  ];
  for (const template of templates) {
    const project = generateProject(
      compileGameSpec(
        "An original family friendly game with a complete objective",
        template,
      ),
    );
    for (const path of [
      "src/main.ts",
      "tests/generated.spec.ts",
      "playwright.config.ts",
    ]) {
      const result = ts.transpileModule(project.files[path], {
          reportDiagnostics: true,
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
          },
        }),
        errors = (result.diagnostics || []).filter(
          (d) => d.category === ts.DiagnosticCategory.Error,
        );
      assert.deepEqual(
        errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")),
        [],
        `${template} ${path}`,
      );
    }
  }
});
test("generated Phaser source passes semantic TypeScript checking against the installed engine", () => {
  const project = generateProject(
    compileGameSpec(
      "A complete original platform game with hazards and a final goal",
      "platformer",
    ),
  );
  const virtual = fileURLToPath(
      new URL("../.virtual-generated-main.ts", import.meta.url),
    ),
    virtualKey = virtual.replaceAll("\\", "/").toLowerCase(),
    isVirtual = (name) =>
      name.replaceAll("\\", "/").toLowerCase() === virtualKey;
  const source = project.files["src/main.ts"].replace(
    'import specData from "../game-spec.json";',
    "const specData:any={};",
  );
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
  };
  const host = ts.createCompilerHost(options),
    original = host.getSourceFile.bind(host),
    anchor = fileURLToPath(
      new URL("../app/generated-entry.ts", import.meta.url),
    );
  host.getSourceFile = (name, language, onError, fresh) =>
    isVirtual(name)
      ? ts.createSourceFile(name, source, language, true)
      : original(name, language, onError, fresh);
  host.fileExists = (name) => isVirtual(name) || ts.sys.fileExists(name);
  host.readFile = (name) => (isVirtual(name) ? source : ts.sys.readFile(name));
  host.resolveModuleNames = (names) =>
    names.map(
      (name) =>
        ts.resolveModuleName(name, anchor, options, ts.sys).resolvedModule,
    );
  const diagnostics = ts
    .getPreEmitDiagnostics(ts.createProgram([virtual], options, host))
    .filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(
    diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")),
    [],
  );
});
test("standalone preview is playable, lifecycle-aware, and network isolated", () => {
  const html = generatePreviewHtml(
      compileGameSpec("A racing game in a cyber city"),
    ),
    check = validatePreviewArtifact(html);
  assert.equal(check.valid, true);
  assert.match(html, /requestAnimationFrame/);
  assert.match(html, /preview\.ready/);
  assert.match(html, /game\.victory/);
  assert.match(html, /game\.restarted/);
  assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//i);
});

test("clocktower standalone preview runs platform physics and animated gear hazards", () => {
  const spec = compileGameSpec(
    "A 2D clocktower ascent game where each floor is a short platforming challenge and gears act as moving hazards.",
  );
  const html = generatePreviewHtml(spec);
  assert.match(html, /CLIMB TO THE BELFRY/);
  assert.match(html, /function gearAt/);
  assert.match(html, /function physics/);
  assert.match(html, /game\.victory/);
  assert.match(html, /FLOOR 3/);
  assert.equal(validatePreviewArtifact(html).valid, true);
});

test("tank standalone preview renders armored teams and projectile combat", () => {
  const spec = compileGameSpec(
      "A top-down tank battle with a green player tank and red enemy tanks",
      "tank",
    ),
    html = generatePreviewHtml(spec);
  assert.match(html, /SPACE FIRE/);
  assert.match(html, /function tank/);
  assert.match(html, /bullets=\[\]/);
  assert.match(html, /RED TANKS/);
  assert.match(html, /FIELD SECURED/);
  assert.match(html, /#711e26/);
  assert.match(html, /#264c29/);
  assert.equal(validatePreviewArtifact(html).valid, true);
});

test("cyber Metroidvania preview uses the curated Neon Sentinel artwork", () => {
  const spec = compileGameSpec(
      "Neon Sentinel is a cyberpunk Metroidvania with a runner and plasma combat",
      "metroidvania",
    ),
    html = enhancePreviewWithGeneratedArt(generatePreviewHtml(spec), spec);
  assert.match(
    html,
    /game-art\/neon-sentinel\/sector-09-background-v1\.png/,
  );
  assert.match(html, /game-art\/neon-sentinel\/runner-atlas-v1\.png/);
  assert.match(html, /generatedArt\.spritesheet/);
});
