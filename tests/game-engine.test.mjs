import assert from "node:assert/strict";
import test from "node:test";
import {
  compileGameSpec,
  inferTemplate,
  togglePuzzle,
  validateGameSpec,
} from "../app/game-engine.mjs";

test("compiler selects all three gameplay templates", () => {
  assert.equal(
    inferTemplate("A fox explores a forest and talks to villagers"),
    "top_down",
  );
  assert.equal(
    inferTemplate("A hero must jump across platforms in space"),
    "platformer",
  );
  assert.equal(
    inferTemplate("Solve a neon logic puzzle in an escape room"),
    "puzzle",
  );
});

test("clocktower platforming prompt preserves identity and moving gear hazards", () => {
  const prompt = "A 2D clocktower ascent game where each floor is a short platforming challenge and gears act as moving hazards.";
  const spec = compileGameSpec(prompt);
  assert.equal(spec.template, "platformer");
  assert.equal(spec.theme, "clockwork");
  assert.match(spec.title, /Clocktower Ascent/i);
  assert.match(spec.objective, /clocktower floor/i);
  assert.ok(spec.hazards.length >= 4);
  assert.ok(spec.hazards.every((hazard) => hazard.type === "gear"));
  assert.ok(spec.hazards.every((hazard) => hazard.motion?.range > 0));
  assert.match(spec.art.manifest.environment, /clocktower/i);
});

test("compiler recognizes metroidvania, roguelike and shooter prompts", () => {
  assert.equal(
    inferTemplate("An interconnected metroidvania with a grapple hook"),
    "metroidvania",
  );
  assert.equal(
    inferTemplate("A procedural roguelike dungeon with permadeath"),
    "roguelike",
  );
  assert.equal(
    inferTemplate("A bullet hell shoot em up with a boss fight"),
    "shooter",
  );
});

test("explicit RPG identity is preserved in the fallback art contract", () => {
  const prompt =
    "Shadows of Aethelgard: Neon Covenant. A sci-fi RPG. Play as a cybernetic spell-blade with a plasma longsword aboard an orbital sanctuary.";
  const spec = compileGameSpec(prompt);
  assert.equal(spec.template, "rpg");
  assert.equal(spec.title, "Shadows of Aethelgard: Neon Covenant");
  assert.equal(spec.art.hero, "Cybernetic Spell-Blade");
  assert.match(spec.art.manifest.environment, /orbital sanctuary/i);
  assert.match(spec.art.manifest.hero, /plasma longsword/i);
  assert.equal(validateGameSpec(spec).valid, true);
});

test("compiler recognizes arcade, sport, vehicle, and combat genres", () => {
  assert.equal(
    inferTemplate("A snake game where a serpent eats apples"),
    "snake",
  );
  assert.equal(
    inferTemplate("A Tetris style falling blocks puzzle"),
    "falling_blocks",
  );
  assert.equal(inferTemplate("A tank battle across a ruined city"), "tank");
  assert.equal(inferTemplate("A fast tennis match on a neon court"), "tennis");
  assert.equal(inferTemplate("A shooting game with enemy waves"), "shooter");
  assert.equal(inferTemplate("A car racing game in a city"), "racing");
});

test("compiler is deterministic and produces valid portable specs", () => {
  const prompt = "A pirate explores ocean islands and collects ancient maps";
  const first = compileGameSpec(prompt);
  const second = compileGameSpec(prompt);
  assert.deepEqual(first, second);
  assert.equal(validateGameSpec(first).valid, true);
  assert.equal(first.theme, "ocean");
});

test("each template contains its required data-driven mechanics", () => {
  const adventure = compileGameSpec(
    "Explore a magical forest and collect relics",
    "top_down",
  );
  const platformer = compileGameSpec("Run through a cyber city", "platformer");
  const puzzle = compileGameSpec("Open an ancient desert vault", "puzzle");
  assert.equal(adventure.collectibles.length, 3);
  assert.ok(adventure.obstacles.length);
  assert.ok(adventure.npc);
  assert.equal(platformer.collectibles.length, 8);
  assert.ok(platformer.platforms.length >= 9);
  assert.ok(platformer.goal);
  assert.ok(platformer.hazards.length);
  assert.ok(platformer.enemies.length);
  assert.ok(platformer.checkpoints.length);
  assert.equal(puzzle.puzzle.initial.length, 9);
  assert.equal(puzzle.puzzle.rule, "toggle_cross");
});

test("puzzle mechanic toggles a cross without mutating input", () => {
  const board = Array(9).fill(false);
  const next = togglePuzzle(board, 4);
  assert.deepEqual(next, [
    false,
    true,
    false,
    true,
    true,
    true,
    false,
    true,
    false,
  ]);
  assert.deepEqual(board, Array(9).fill(false));
});

test("art direction changes with the prompt subject", () => {
  const fox = compileGameSpec("A fox explores a cozy magical forest");
  const robot = compileGameSpec("A robot explores a neon cyber city");
  assert.equal(fox.art.avatar, "animal");
  assert.equal(robot.art.avatar, "robot");
  assert.notDeepEqual(fox.art.palette, robot.art.palette);
  assert.notDeepEqual(fox.art.motifs, robot.art.motifs);
});

test("character direction includes archetype, equipment, and animation states", () => {
  const spec = compileGameSpec(
    "A moon fox ranger explores glowing forest ruins",
  );
  assert.equal(spec.art.characterDesign.archetype, spec.art.avatar);
  assert.ok(spec.art.characterDesign.role);
  assert.ok(spec.art.characterDesign.equipment.length >= 1);
  assert.deepEqual(spec.art.characterDesign.animationStates, [
    "idle",
    "walk",
    "action",
    "hurt",
    "victory",
  ]);
});

test("advanced genres compile their defining mechanics", () => {
  const metro = compileGameSpec("A forest metroidvania with backtracking");
  const rogue = compileGameSpec("A cyber roguelike with permadeath");
  const shooter = compileGameSpec("A space bullet hell boss fight");
  assert.equal(validateGameSpec(metro).valid, true);
  assert.equal(metro.abilities.length, 2);
  assert.ok(metro.gates.length);
  assert.equal(validateGameSpec(rogue).valid, true);
  assert.equal(rogue.permadeath, true);
  assert.ok(rogue.drops.length);
  assert.equal(validateGameSpec(shooter).valid, true);
  assert.ok(shooter.enemies.length);
  assert.equal(shooter.boss.hp, 8);
});

test("Neon Sentinel compiles a data-driven movement combat and object contract", () => {
  const spec = compileGameSpec(
    "Neon Sentinel is a cyberpunk side-scrolling action platformer with Metroidvania-lite exploration, double jump, dash, wall jump, energy blade, plasma blast, gates, crates, lasers, drones, scrapper bots and turrets",
  );
  assert.equal(spec.template, "metroidvania");
  assert.equal(spec.theme, "cyber");
  assert.ok(spec.movement.dashSpeed > spec.movement.runSpeed);
  assert.ok(spec.movement.invulnerabilityMs > spec.movement.dashDurationMs);
  assert.deepEqual(spec.combat.meleeCombo, [1, 1, 2]);
  assert.equal(spec.combat.maxEnergy, 100);
  assert.ok(spec.platforms.length >= 8);
  assert.ok(spec.hazards.some((item) => item.type === "laser"));
  assert.ok(spec.interactables.some((item) => item.type === "pressure_plate"));
  assert.ok(spec.interactables.some((item) => item.type === "breakable_crate"));
  assert.deepEqual(
    new Set(spec.enemies.map((enemy) => enemy.type)),
    new Set(["patrol_drone", "scrapper_bot", "turret"]),
  );
});

test("new genre specs contain playable defining mechanics", () => {
  const snake = compileGameSpec("A snake game that eats glowing fruit");
  const blocks = compileGameSpec("A Tetris falling blocks challenge");
  const tank = compileGameSpec("A tank battle in a desert arena");
  const tennis = compileGameSpec("A tennis game against an adaptive rival");
  const racing = compileGameSpec("A car racing game in a neon city");
  for (const spec of [snake, blocks, tank, tennis, racing])
    assert.equal(validateGameSpec(spec).valid, true);
  assert.equal(snake.snake.start.length, 3);
  assert.equal(snake.grid.cols, 18);
  assert.equal(blocks.pieces.length, 7);
  assert.equal(blocks.board.cols, 10);
  assert.ok(tank.cover.length);
  assert.ok(tank.enemies.length);
  assert.equal(tennis.targetScore, 5);
  assert.ok(tennis.ball.speed);
  assert.equal(racing.track.laps, 3);
  assert.ok(racing.opponents.length);
});

test("compiler covers strategy, RPG, card, simulation and narrative families", () => {
  const cases = [
    ["A tower defense strategy game", "strategy"],
    ["An RPG with quests and inventory", "rpg"],
    ["A tactical deckbuilder card game", "card"],
    ["A cozy farming simulation game", "simulation"],
    ["A visual novel with branching story choices", "narrative"],
  ];
  for (const [prompt, template] of cases) {
    const spec = compileGameSpec(prompt);
    assert.equal(spec.template, template);
    assert.equal(validateGameSpec(spec).valid, true);
  }
  assert.ok(compileGameSpec(cases[0][0]).units.length);
  assert.ok(compileGameSpec(cases[1][0]).quests.length);
  assert.ok(compileGameSpec(cases[2][0]).deck.length);
  assert.ok(compileGameSpec(cases[3][0]).stations.length);
  assert.ok(Object.keys(compileGameSpec(cases[4][0]).nodes).length);
});
