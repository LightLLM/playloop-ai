import assert from "node:assert/strict";
import test from "node:test";
import {
  createBody,
  overlaps,
  respawnBody,
  stepPhysics,
} from "../app/physics-engine.mjs";

const world = {
  width: 100,
  height: 100,
  platforms: [
    { x: 0, y: 80, w: 40, h: 5 },
    { x: 55, y: 62, w: 25, h: 5 },
  ],
  hazards: [{ x: 42, y: 82, w: 8, h: 8 }],
  enemies: [{ x: 70, y: 52, w: 5, h: 8 }],
};

test("gravity accelerates airborne bodies and swept landing stops at platform top", () => {
  let body = createBody({ x: 10, y: 20 });
  for (let i = 0; i < 120; i++) body = stepPhysics(body, {}, world).body;
  assert.equal(body.y, 70);
  assert.equal(body.vy, 0);
  assert.equal(body.grounded, true);
});
test("jump only starts while grounded", () => {
  const grounded = { ...createBody({ x: 10, y: 70 }), grounded: true };
  const jumped = stepPhysics(grounded, { jump: true }, world).body;
  assert.ok(jumped.vy < 0);
  const airborne = stepPhysics(
    { ...jumped, grounded: false },
    { jump: true },
    world,
  ).body;
  assert.ok(airborne.vy > jumped.vy);
});
test("body falls through gaps and reports world exit", () => {
  let body = createBody({ x: 47, y: 60 });
  let fell = false;
  for (let i = 0; i < 180; i++) {
    const result = stepPhysics(body, {}, world);
    body = result.body;
    fell ||= result.events.fell;
  }
  assert.equal(fell, true);
});
test("hazards and enemies use two-dimensional AABB hitboxes", () => {
  assert.equal(
    stepPhysics({ ...createBody({ x: 43, y: 82 }), vy: 0 }, {}, world).events
      .hazard,
    true,
  );
  assert.ok(
    stepPhysics({ ...createBody({ x: 70, y: 52 }), vy: 0 }, {}, world).events
      .enemy >= 0,
  );
  assert.equal(
    overlaps({ x: 0, y: 0, w: 2, h: 2 }, { x: 3, y: 3, w: 2, h: 2 }),
    false,
  );
});
test("checkpoint respawn resets velocity and grounded state", () => {
  const body = respawnBody({ x: 55, y: 62 });
  assert.deepEqual(
    { x: body.x, y: body.y, vx: body.vx, vy: body.vy, grounded: body.grounded },
    { x: 55, y: 52, vx: 0, vy: 0, grounded: false },
  );
});
