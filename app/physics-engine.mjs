export const PHYSICS = Object.freeze({ gravity: 92, moveSpeed: 34, jumpSpeed: 47, maxFallSpeed: 58, bodyWidth: 4, bodyHeight: 10, fixedStep: 1 / 60 });

export function overlaps(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

export function positionHazard(hazard, elapsedSeconds = 0) {
  const motion = hazard.motion;
  if (!motion) return { ...hazard };
  const offset = Math.sin(elapsedSeconds * (motion.speed || 1) * Math.PI * 2) * (motion.range || 0);
  return {
    ...hazard,
    x: hazard.x + (motion.axis === "x" ? offset : 0),
    y: (hazard.y ?? 80) + (motion.axis === "y" ? offset : 0),
  };
}

export function createBody(start = { x: 8, y: 65 }) { return { x: start.x, y: start.y, vx: 0, vy: 0, w: PHYSICS.bodyWidth, h: PHYSICS.bodyHeight, grounded: false, facing: 1 }; }

export function stepPhysics(body, input, world, dt = PHYSICS.fixedStep) {
  const previous = { ...body }; const next = { ...body };
  next.vx = (Number(Boolean(input.right)) - Number(Boolean(input.left))) * PHYSICS.moveSpeed;
  if (next.vx) next.facing = Math.sign(next.vx);
  if (input.jump && body.grounded) { next.vy = -PHYSICS.jumpSpeed; next.grounded = false; }
  next.vy = Math.min(PHYSICS.maxFallSpeed, next.vy + PHYSICS.gravity * dt);
  next.x += next.vx * dt; next.x = Math.max(0, Math.min((world.width || 240) - next.w, next.x));
  next.y += next.vy * dt; next.grounded = false;

  for (const platform of world.platforms || []) {
    const solid = { x: platform.x, y: platform.y, w: platform.w, h: platform.h || 5 };
    const horizontal = next.x + next.w > solid.x && next.x < solid.x + solid.w;
    const wasAbove = previous.y + previous.h <= solid.y + 0.4;
    if (horizontal && wasAbove && next.y + next.h >= solid.y && next.vy >= 0) { next.y = solid.y - next.h; next.vy = 0; next.grounded = true; }
    else if (overlaps(next, solid) && !wasAbove) { if (next.vx > 0) next.x = solid.x - next.w; else if (next.vx < 0) next.x = solid.x + solid.w; next.vx = 0; }
  }

  const hazard = (world.hazards || []).some((source) => { const h = positionHazard(source, world.elapsedSeconds || 0); return overlaps(next, { x: h.x, y: h.y ?? 80, w: h.w, h: h.h || 9 }); });
  const enemy = (world.enemies || []).findIndex((e) => overlaps(next, { x: e.x, y: e.y, w: e.w || 5, h: e.h || 7 }));
  return { body: next, events: { fell: next.y > (world.height || 100) + 12, hazard, enemy } };
}

export function respawnBody(checkpoint) { return createBody({ x: checkpoint.x, y: checkpoint.y - PHYSICS.bodyHeight }); }
