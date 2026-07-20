const GENRE_AUDIO = {
  top_down: { bpm: 94, scale: "major-pentatonic", lead: "triangle", bass: "sine", ambience: "forest", rhythm: [1, 0, 0, 1, 0, 1, 0, 0] },
  platformer: { bpm: 132, scale: "major-pentatonic", lead: "square", bass: "triangle", ambience: "open-air", rhythm: [1, 0, 1, 0, 1, 1, 0, 1] },
  metroidvania: { bpm: 104, scale: "minor", lead: "sawtooth", bass: "sine", ambience: "cavern", rhythm: [1, 0, 0, 1, 0, 0, 1, 0] },
  roguelike: { bpm: 116, scale: "minor-pentatonic", lead: "triangle", bass: "square", ambience: "dungeon", rhythm: [1, 0, 1, 1, 0, 1, 0, 1] },
  puzzle: { bpm: 82, scale: "whole-tone", lead: "sine", bass: "triangle", ambience: "crystal", rhythm: [1, 0, 0, 0, 1, 0, 0, 0] },
  shooter: { bpm: 148, scale: "minor-pentatonic", lead: "sawtooth", bass: "square", ambience: "industrial", rhythm: [1, 1, 0, 1, 1, 0, 1, 1] },
  snake: { bpm: 124, scale: "major-pentatonic", lead: "square", bass: "triangle", ambience: "arcade", rhythm: [1, 0, 1, 0, 1, 0, 1, 1] },
  falling_blocks: { bpm: 126, scale: "minor", lead: "square", bass: "triangle", ambience: "arcade", rhythm: [1, 0, 1, 0, 1, 1, 0, 0] },
  tank: { bpm: 108, scale: "minor-pentatonic", lead: "sawtooth", bass: "square", ambience: "battlefield", rhythm: [1, 0, 1, 1, 0, 1, 0, 1] },
  tennis: { bpm: 128, scale: "major-pentatonic", lead: "triangle", bass: "sine", ambience: "stadium", rhythm: [1, 0, 1, 0, 1, 0, 1, 0] },
  racing: { bpm: 154, scale: "minor-pentatonic", lead: "sawtooth", bass: "square", ambience: "engine", rhythm: [1, 1, 0, 1, 1, 1, 0, 1] },
  strategy: { bpm: 88, scale: "minor", lead: "triangle", bass: "sine", ambience: "command", rhythm: [1, 0, 0, 1, 0, 0, 1, 0] },
  rpg: { bpm: 96, scale: "dorian", lead: "triangle", bass: "sine", ambience: "mystic", rhythm: [1, 0, 0, 1, 0, 1, 0, 0] },
  card: { bpm: 90, scale: "harmonic-minor", lead: "triangle", bass: "sine", ambience: "arcane", rhythm: [1, 0, 0, 1, 0, 0, 1, 0] },
  simulation: { bpm: 102, scale: "major-pentatonic", lead: "sine", bass: "triangle", ambience: "workshop", rhythm: [1, 0, 1, 0, 0, 1, 0, 0] },
  narrative: { bpm: 72, scale: "minor", lead: "sine", bass: "triangle", ambience: "nocturne", rhythm: [1, 0, 0, 0, 0, 1, 0, 0] },
};

const SCALES = {
  "major-pentatonic": [0, 2, 4, 7, 9, 12],
  "minor-pentatonic": [0, 3, 5, 7, 10, 12],
  minor: [0, 2, 3, 5, 7, 8, 10, 12],
  dorian: [0, 2, 3, 5, 7, 9, 10, 12],
  "whole-tone": [0, 2, 4, 6, 8, 10, 12],
  "harmonic-minor": [0, 2, 3, 5, 7, 8, 11, 12],
};

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}

function seeded(seed) {
  let state = seed || 1;
  return () => ((state = Math.imul(1664525, state) + 1013904223 >>> 0) / 4294967296);
}

export function compileAudioPlan(spec) {
  const template = spec?.template || "top_down",
    base = GENRE_AUDIO[template] || GENRE_AUDIO.top_down,
    prompt = String(spec?.prompt || "").toLowerCase(),
    theme = String(spec?.theme || "forest"),
    seed = Number(spec?.art?.seed) || hash(prompt),
    random = seeded(seed),
    cyber = /cyber|neon|synth|robot|space/.test(prompt),
    horror = /horror|haunt|ghost|dark|night|silence/.test(prompt),
    cozy = /cozy|gentle|calm|farm|tavern/.test(prompt),
    clockwork = /clock|gear|steam|inventor/.test(prompt),
    resonance = /\b(?:sound waves?|sonic|audio frequenc(?:y|ies)|frequency magic|resonance magic|resonant spell|echo magic|music magic)\b/.test(prompt),
    scaleName = resonance ? "dorian" : horror ? "harmonic-minor" : base.scale,
    scale = SCALES[scaleName],
    rootMidi = cyber ? 45 : horror ? 43 : cozy ? 50 : 48,
    pattern = Array.from({ length: 16 }, (_, index) => {
      const degree = Math.floor(random() * scale.length);
      return index % 4 === 3 && random() > .48 ? -1 : rootMidi + scale[degree] + (random() > .78 ? 12 : 0);
    });
  return {
    version: "1.0.0",
    seed,
    template,
    theme,
    bpm: Math.max(58, Math.min(168, base.bpm + (cyber ? 8 : 0) - (horror ? 12 : 0) - (cozy ? 8 : 0))),
    scale: scaleName,
    leadWave: cyber ? "sawtooth" : cozy ? "sine" : base.lead,
    bassWave: base.bass,
    ambience: resonance ? "resonant-cavern" : clockwork ? "clockwork" : base.ambience,
    rhythm: base.rhythm,
    pattern,
    mix: { master: cozy ? .28 : .42, music: .62, ambience: .16, effects: .82 },
    cues: {
      move: { midi: rootMidi + 12, duration: .035 },
      jump: { midi: rootMidi + 19, duration: .11 },
      fire: { midi: cyber ? 76 : rootMidi + 24, duration: .055 },
      collect: { midi: rootMidi + 28, duration: .14 },
      interact: { midi: rootMidi + 16, duration: .1 },
      skill: { midi: resonance ? 81 : rootMidi + 21, duration: .22 },
      hit: { midi: rootMidi - 7, duration: .12 },
      victory: { midi: rootMidi + 31, duration: .42 },
      failure: { midi: rootMidi - 12, duration: .4 },
    },
  };
}

export function deriveAudioCue(progress = {}) {
  const event = String(progress.event || "");
  if (/victory/.test(event) || progress.bossHp === 0) return "victory";
  if (/failure|damage|hurt/.test(event)) return "failure";
  if (/skill:|ability|unlocked/.test(event)) return "skill";
  if (/fire|shot|sound-wave|card/.test(event) || progress.shots) return "fire";
  if (/collect|quest-complete|relic/.test(event)) return "collect";
  if (/interact|choice|node/.test(event)) return "interact";
  return null;
}

const midiFrequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function createProceduralAudioEngine(plan, target = globalThis) {
  let context, master, timer, step = 0, nextNote = 0, enabled = false, lastCue = new Map();
  const createContext = () => {
    if (context) return context;
    const Context = target.AudioContext || target.webkitAudioContext;
    if (!Context) return null;
    context = new Context();
    master = context.createGain();
    master.gain.value = plan.mix.master;
    master.connect(context.destination);
    return context;
  };
  const note = (midi, duration, wave, volume, when) => {
    if (!context || midi < 0) return;
    const oscillator = context.createOscillator(), gain = context.createGain(), start = when ?? context.currentTime;
    oscillator.type = wave;
    oscillator.frequency.value = midiFrequency(midi);
    gain.gain.setValueAtTime(Math.max(.0001, volume), start);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + .03);
  };
  const schedule = () => {
    if (!context || !enabled) return;
    while (nextNote < context.currentTime + .12) {
      const beat = 60 / plan.bpm / 2, midi = plan.pattern[step % plan.pattern.length];
      if (midi >= 0) note(midi, beat * .75, plan.leadWave, plan.mix.music * .08, nextNote);
      if (step % 4 === 0) note(plan.pattern[step % plan.pattern.length] - 24, beat * 1.8, plan.bassWave, plan.mix.music * .065, nextNote);
      if (plan.rhythm[step % plan.rhythm.length]) note(38, .025, "square", .018, nextNote);
      nextNote += beat;
      step++;
    }
  };
  return {
    plan,
    async start() {
      if (!createContext()) return false;
      if (context.state === "suspended") await context.resume();
      enabled = true;
      nextNote = context.currentTime + .03;
      clearInterval(timer);
      timer = setInterval(schedule, 50);
      schedule();
      return true;
    },
    async pause() {
      enabled = false;
      clearInterval(timer);
      if (context?.state === "running") await context.suspend();
    },
    playCue(name) {
      if (!enabled || !context || !plan.cues[name]) return;
      const now = context.currentTime, previous = lastCue.get(name) || 0;
      if (now - previous < .08) return;
      lastCue.set(name, now);
      const cue = plan.cues[name];
      if (plan.template === "tank" && name === "fire") {
        note(42, .18, "sawtooth", .18, now);
        note(30, .24, "square", .12, now + .018);
      }
      note(cue.midi, cue.duration, name === "hit" || name === "failure" ? "sawtooth" : plan.leadWave, plan.mix.effects * .12, now);
      if (name === "victory") note(cue.midi + 7, cue.duration * .9, "triangle", plan.mix.effects * .08, now + .12);
    },
    async destroy() {
      enabled = false;
      clearInterval(timer);
      if (context && context.state !== "closed") await context.close();
      context = null;
    },
    isEnabled: () => enabled,
  };
}

export const audioGenreProfiles = Object.freeze(GENRE_AUDIO);
