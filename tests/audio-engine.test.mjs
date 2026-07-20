import assert from "node:assert/strict";
import test from "node:test";
import { compileGameSpec } from "../app/game-engine.mjs";
import {
  audioGenreProfiles,
  compileAudioPlan,
  createProceduralAudioEngine,
  deriveAudioCue,
} from "../app/audio-engine.mjs";

test("every game genre has a procedural audio identity", () => {
  const templates = [
    "top_down", "platformer", "metroidvania", "roguelike", "puzzle",
    "shooter", "snake", "falling_blocks", "tank", "tennis", "racing",
    "strategy", "rpg", "card", "simulation", "narrative",
  ];
  assert.deepEqual(Object.keys(audioGenreProfiles).sort(), templates.sort());
  for (const template of templates) {
    const spec = compileGameSpec("An original complete 2D game with a clear goal", template),
      plan = compileAudioPlan(spec);
    assert.equal(plan.template, template);
    assert.ok(plan.bpm >= 58 && plan.bpm <= 168);
    assert.equal(plan.pattern.length, 16);
    assert.ok(plan.pattern.some((note) => note > 0));
    assert.ok(plan.cues.victory.midi > plan.cues.failure.midi);
  }
});

test("audio plans are deterministic and respond to prompt identity", () => {
  const resonance = compileGameSpec(
      "Title: Resonance Hollow. A sonic RPG using sound waves and frequency magic.",
      "rpg",
    ),
    cyber = compileGameSpec(
      "Title: Neon Momentum. A cyber neon shooter in a synth factory.",
      "shooter",
    ),
    a = compileAudioPlan(resonance),
    b = compileAudioPlan(resonance),
    c = compileAudioPlan(cyber);
  assert.deepEqual(a, b);
  assert.equal(a.ambience, "resonant-cavern");
  assert.equal(a.scale, "dorian");
  assert.equal(c.leadWave, "sawtooth");
  assert.notDeepEqual(a.pattern, c.pattern);
});

test("ordinary sound-effect requests do not override genre ambience", () => {
  const tank = compileGameSpec(
      "A tank battle with a tense soundtrack, cannon sound effects, and victory music.",
      "tank",
    ),
    plan = compileAudioPlan(tank);
  assert.equal(plan.ambience, "battlefield");
  assert.equal(plan.scale, "minor-pentatonic");
  assert.ok(plan.mix.master >= .35, "tank output should be clearly audible");
});

test("runtime progress maps to meaningful sound cues", () => {
  assert.equal(deriveAudioCue({ event: "quest-complete" }), "collect");
  assert.equal(deriveAudioCue({ event: "skill:Bass Impact" }), "skill");
  assert.equal(deriveAudioCue({ event: "sound-wave" }), "fire");
  assert.equal(deriveAudioCue({ bossHp: 0 }), "victory");
  assert.equal(deriveAudioCue({ event: "game.failure" }), "failure");
  assert.equal(deriveAudioCue({}), null);
});

test("audio engine waits for user activation and cleans up", async () => {
  const events = [], fakeContext = {
      state: "running", currentTime: 1, destination: {},
      createGain: () => ({ gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() { return this; } }),
      createOscillator: () => ({ type: "sine", frequency: { value: 0 }, connect() { return this; }, start() { events.push("start"); }, stop() {} }),
      resume: async () => { fakeContext.state = "running"; },
      suspend: async () => { fakeContext.state = "suspended"; },
      close: async () => { fakeContext.state = "closed"; },
    },
    plan = compileAudioPlan(compileGameSpec("A gentle puzzle game", "puzzle")),
    engine = createProceduralAudioEngine(plan, { AudioContext: function () { return fakeContext; } });
  engine.playCue("collect");
  assert.equal(events.length, 0);
  assert.equal(await engine.start(), true);
  engine.playCue("collect");
  assert.ok(events.length > 0);
  await engine.pause();
  assert.equal(engine.isEnabled(), false);
  await engine.destroy();
  assert.equal(fakeContext.state, "closed");
});
