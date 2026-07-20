import { validateContract } from "./game-spec-schema.mjs";
/** @typedef {'top_down'|'platformer'|'metroidvania'|'roguelike'|'puzzle'|'shooter'|'snake'|'falling_blocks'|'tank'|'tennis'|'racing'|'strategy'|'rpg'|'card'|'simulation'|'narrative'} GameTemplate */

const themes = {
  clockwork: {
    words: ["clocktower", "clock tower", "clockwork", "gear", "cog"],
    palette: ["#17131f", "#9a5b36", "#f5cf67"],
    place: "Clocktower Ascent",
    hero: "Gearbound Climber",
  },
  space: {
    words: ["space", "moon", "planet", "alien", "star"],
    palette: ["#111a38", "#7c6cff", "#d5ff62"],
    place: "Starfall Outpost",
    hero: "Nova Scout",
  },
  forest: {
    words: ["forest", "fox", "wood", "nature", "cozy"],
    palette: ["#172d26", "#4b9b63", "#ffd66b"],
    place: "Mosslight Grove",
    hero: "Leaf Runner",
  },
  ocean: {
    words: ["ocean", "sea", "fish", "island", "pirate"],
    palette: ["#092b45", "#20a9b5", "#ffd76a"],
    place: "Tideglass Isles",
    hero: "Wave Keeper",
  },
  cyber: {
    words: ["cyber", "neon", "robot", "city", "future"],
    palette: ["#15122b", "#ff4fd8", "#63f3ff"],
    place: "Neon Circuit",
    hero: "Glitch Courier",
  },
  desert: {
    words: ["desert", "sand", "temple", "ruin"],
    palette: ["#3c241b", "#dc844a", "#ffe09a"],
    place: "Sunken Dunes",
    hero: "Relic Seeker",
  },
};

export function inferTemplate(prompt, override = "auto") {
  if (override !== "auto") return override;
  const text = prompt.toLowerCase();
  if (
    /\b(snake game|growing snake|eat (apples?|food)|serpent arcade)\b/.test(
      text,
    )
  )
    return "snake";
  if (
    /\b(tetris|falling blocks?|tetromino(?:es)?|block stack(?:ing)?)\b/.test(
      text,
    )
  )
    return "falling_blocks";
  if (/\b(tank game|tank battle|battle tanks?|armou?red warfare)\b/.test(text))
    return "tank";
  if (/\b(tennis|racket|racquet|serve and volley|pong)\b/.test(text))
    return "tennis";
  if (
    /\b(car racing|racing game|race cars?|racetrack|driving game|lap race)\b/.test(
      text,
    )
  )
    return "racing";
  if (
    /\b(tower defense|strategy game|real.?time strategy|turn.?based tactics|tactical game)\b/.test(
      text,
    )
  )
    return "strategy";
  if (
    /\b(role.?playing game|rpg|quests? and inventory|level up|character stats)\b/.test(
      text,
    )
  )
    return "rpg";
  if (
    /\b(deckbuilder|deck building|card game|solitaire|collectible cards?)\b/.test(
      text,
    )
  )
    return "card";
  if (
    /\b(farming sim|simulation game|shop simulator|cooking game|city builder|management game)\b/.test(
      text,
    )
  )
    return "simulation";
  if (
    /\b(visual novel|interactive fiction|narrative game|branching story|dialogue choices?)\b/.test(
      text,
    )
  )
    return "narrative";
  if (
    /\b(metroidvania|backtrack|ability.?gate|interconnected map|grapple hook|double jump)\b/.test(
      text,
    )
  )
    return "metroidvania";
  if (
    /\b(roguelike|roguelite|permadeath|procedural run|random dungeon|dungeon run)\b/.test(
      text,
    )
  )
    return "roguelike";
  if (
    /\b(run and gun|shoot.?em.?up|shmup|bullet hell|blaster|boss fight|arcade shooter|shooting game)\b/.test(
      text,
    )
  )
    return "shooter";
  if (
    /\b(platform(?:er|ing)?|jump(?:ing)?|side.?scroll|run and jump|obstacle course|vertical ascent)\b/.test(
      text,
    )
  )
    return "platformer";
  if (
    /\b(puzzle|maze|logic|match|riddle|escape room|solve|lights?)\b/.test(text)
  )
    return "puzzle";
  return "top_down";
}

function inferTheme(prompt) {
  const text = prompt.toLowerCase();
  return (
    Object.entries(themes).find(([, value]) =>
      value.words.some((word) => text.includes(word)),
    )?.[0] || "forest"
  );
}

function hash(text) {
  let value = 2166136261;
  for (const char of text)
    value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

function inferAvatar(prompt) {
  const text = prompt.toLowerCase();
  if (/fox|wolf|cat|dog|animal/.test(text)) return "animal";
  if (/robot|android|mech|drone/.test(text)) return "robot";
  if (/wizard|mage|witch|magic/.test(text)) return "mage";
  if (/pirate|sailor|captain/.test(text)) return "pirate";
  if (/knight|warrior|sword/.test(text)) return "knight";
  return "explorer";
}

function inferExplicitTitle(prompt) {
  const text = String(prompt);
  const match =
    text.match(
      /\btitle\s*:\s*([A-Z][A-Za-z0-9' -]{2,60}(?::\s*[A-Z][A-Za-z0-9' -]{2,40})?)(?=\.|\n|$)/,
    ) ||
    text.match(
      /^([A-Z][A-Za-z0-9' -]{2,55}:\s*[A-Z][A-Za-z0-9' -]{2,40})(?=\.)/,
    );
  return match?.[1]?.trim() || null;
}

function inferPromptTitle(prompt) {
  const match = String(prompt).match(
    /\b(?:an?\s+)?(?:2d\s+)?([a-z0-9][a-z0-9' -]{2,45}?)\s+game\b/i,
  );
  const phrase = match?.[1]
    ?.replace(/^(?:short|simple|original|fast|cozy)\s+/i, "")
    .trim();
  return phrase && phrase.split(/\s+/).length <= 6
    ? phrase.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : null;
}

function inferNamedHero(prompt, fallback) {
  const text = String(prompt);
  const role = text.match(
    /(?:play as|hero is|character is)\s+(?:an?\s+|the\s+)?([a-z][a-z -]{2,55})(?=\s+(?:with|who|wield|carrying)|[.,])/i,
  );
  return role?.[1]
    ? role[1].replace(/\b\w/g, (letter) => letter.toUpperCase())
    : fallback;
}

function inferMotifs(prompt, theme) {
  const text = prompt.toLowerCase();
  const motifs =
    theme === "clockwork"
      ? ["gear", "pendulum", "clockface"]
      : theme === "space"
      ? ["crater", "satellite", "crystal"]
      : theme === "ocean"
        ? ["coral", "shell", "palm"]
        : theme === "cyber"
          ? ["hologram", "circuit", "tower"]
          : theme === "desert"
            ? ["cactus", "obelisk", "sunstone"]
            : ["mushroom", "tree", "flower"];
  if (/dragon/.test(text)) motifs[0] = "dragon";
  if (/castle|kingdom/.test(text)) motifs[1] = "castle";
  if (/ghost|haunt/.test(text)) motifs[2] = "ghost";
  return motifs;
}

export function compileGameSpec(prompt, override = "auto") {
  const clean = String(prompt).trim().replace(/\s+/g, " ");
  if (clean.length < 10)
    throw new Error("Describe the game in at least 10 characters.");
  const template = inferTemplate(clean, override);
  const theme = inferTheme(clean);
  const art = themes[theme];
  const seed = hash(clean);
  const avatar = inferAvatar(clean),
    motifs = inferMotifs(clean, theme);
  const explicitTitle = inferExplicitTitle(clean),
    promptTitle = inferPromptTitle(clean),
    heroName = inferNamedHero(clean, art.hero),
    gameTitle = explicitTitle || promptTitle || art.place;
  const objectives = {
    platformer:
      theme === "clockwork"
        ? "Climb every clocktower floor, avoid the moving gears, and reach the belfry exit."
        : "Collect every spark and reach the portal.",
    metroidvania:
      "Find movement abilities, backtrack, and open the sealed core.",
    roguelike: "Survive the procedural dungeon and descend to the next floor.",
    puzzle: "Solve the crystal mechanism to unlock the vault.",
    shooter: "Dodge enemy fire, clear the wave, and defeat the guardian.",
    snake: "Eat every fruit, grow longer, and avoid your own trail.",
    falling_blocks:
      "Complete horizontal lines before the blocks reach the top.",
    tank: "Destroy the enemy armor while using cover to survive.",
    tennis: "Return the ball past your rival and win the match.",
    racing: "Pass every checkpoint and finish the required laps.",
    strategy: "Gather resources, place units, and defend the command core.",
    rpg: "Complete quests, improve your hero, and defeat the final guardian.",
    card: "Build a strong deck and defeat the opposing champion.",
    simulation:
      "Manage resources and grow the operation through three milestones.",
    narrative: "Make meaningful choices and reach one of several endings.",
    top_down: "Collect three relics and meet the guide.",
  };
  const actions =
    template === "platformer"
      ? ["move", "jump", "attack"]
      : template === "shooter" || template === "tank"
        ? ["move", "aim", "fire"]
        : template === "tennis"
          ? ["move paddle", "serve", "return"]
          : template === "racing"
            ? ["steer", "accelerate", "brake"]
            : ["move", "interact", "restart"];
  const common = {
    schemaVersion: "1.0.0",
    id: `game-${seed.toString(36)}`,
    title: gameTitle,
    prompt: clean,
    template,
    theme,
    objective: objectives[template],
    audience: "family",
    viewport: {
      width: 960,
      height: 540,
      orientation: "landscape",
      scaling: "fit",
      mobileControls: true,
    },
    gameLoop: {
      goal: objectives[template],
      actions,
      failure: "Lose health, leave the playfield, or reach a terminal hazard.",
      victory: objectives[template],
      restart: "Reset the current level while retaining saved progression.",
    },
    scenes: ["preload", "menu", "tutorial", "gameplay", "pause", "results"],
    progression: {
      levels: 3,
      difficulty: "rising",
      scoring: "Reward objectives, survival, and efficient play.",
      unlocks: [],
    },
    persistence: { saveProgress: true, highScores: true, settings: true },
    audio: {
      music: "adaptive procedural ambience",
      effects: true,
      objectiveSpeech: true,
    },
    testing: {
      requiredActions: actions,
      expectedStates: ["menu", "playing", "victory", "failure", "restarted"],
      maxLoadMs: 3000,
      minFps: 50,
    },
    art: {
      style: "procedural_layered_pixel_art",
      direction: `Original cohesive 32-bit pixel art for ${gameTitle}; ${art.palette.join(", ")} palette; readable game silhouettes; consistent ${avatar} proportions; ${motifs.join(", ")} motifs; prompt-specific world and equipment; no text or logos`,
      palette: art.palette,
      hero: heroName,
      avatar,
      motifs,
      seed,
      characterDesign: {
        archetype: avatar,
        role: heroName,
        silhouette: `${avatar} with a readable ${heroName} profile`,
        equipment: motifs.slice(0, 2),
        expression: "determined and approachable",
        animationStates: ["idle", "walk", "action", "hurt", "victory"],
      },
      fallbackProvenance: {
        source: "playloop-procedural",
        algorithm: "seeded-layered-pixel-art-v2",
        promptDerived: true,
        externalNetwork: false,
      },
      manifest: {
        environment: `Original cohesive 32-bit pixel art for ${gameTitle}; ${art.palette.join(", ")} palette. Layered ${theme} environment derived from this prompt: ${clean.slice(0, 420)}. Camera appropriate for a ${template} game, no characters, text, or logos`,
        hero: `Original cohesive 32-bit pixel art for ${gameTitle}; ${art.palette.join(", ")} palette. Full-body ${avatar} ${heroName} derived from this prompt: ${clean.slice(0, 420)}. transparent background, no text`,
        props: `Original cohesive 32-bit pixel art for ${gameTitle}; ${art.palette.join(", ")} palette. Clean sprite sheet of collectibles, hazards, and interactive props derived from this prompt: ${clean.slice(0, 420)}. transparent background, no text`,
        spritesheet: `Original cohesive 32-bit pixel art for ${gameTitle}; ${art.palette.join(", ")} palette. ${avatar} ${heroName}, exact 4 by 4 grid with sixteen equal frames for idle, walk, action, hurt, and victory. Preserve the prompt-specific costume and equipment. transparent background, no text`,
      },
    },
    world: { width: 100, height: 100 },
    player: {
      start: template === "platformer" ? { x: 8, y: 72 } : { x: 48, y: 64 },
      speed: 6,
    },
  };
  if (template === "platformer")
    return {
      ...common,
      world: { width: 240, height: 100 },
      platforms: [
        { x: 0, y: 86, w: 30 },
        { x: 36, y: 73, w: 18 },
        { x: 61, y: 58, w: 20 },
        { x: 88, y: 78, w: 28 },
        { x: 122, y: 63, w: 19 },
        { x: 148, y: 48, w: 17 },
        { x: 172, y: 72, w: 25 },
        { x: 204, y: 55, w: 20 },
        { x: 226, y: 82, w: 14 },
      ],
      collectibles: [
        { x: 16, y: 73 },
        { x: 48, y: 60 },
        { x: 72, y: 45 },
        { x: 100, y: 65 },
        { x: 134, y: 50 },
        { x: 158, y: 35 },
        { x: 184, y: 59 },
        { x: 215, y: 42 },
      ],
      hazards: [
        ...(theme === "clockwork"
          ? [
              { x: 42, y: 64, w: 8, h: 8, type: "gear", motion: { axis: "x", range: 8, speed: 1.25 } },
              { x: 94, y: 69, w: 9, h: 9, type: "gear", motion: { axis: "y", range: 9, speed: 1.05 } },
              { x: 151, y: 38, w: 8, h: 8, type: "gear", motion: { axis: "x", range: 10, speed: 1.4 } },
              { x: 207, y: 46, w: 9, h: 9, type: "gear", motion: { axis: "y", range: 8, speed: 1.2 } },
            ]
          : [
              { x: 29, y: 82, w: 7, type: "spikes" },
              { x: 79, y: 82, w: 9, type: "spikes" },
              { x: 116, y: 82, w: 6, type: "spikes" },
              { x: 197, y: 82, w: 7, type: "spikes" },
            ]),
      ],
      enemies: [
        { x: 52, y: 66, type: "beetle" },
        { x: 109, y: 71, type: "slime" },
        { x: 180, y: 65, type: "beetle" },
        { x: 218, y: 48, type: "slime" },
      ],
      checkpoints: [
        { x: 112, y: 70 },
        { x: 199, y: 70 },
      ],
      decorations: Array.from({ length: 12 }, (_, i) => ({
        x: 10 + i * 19,
        y: i % 3 === 0 ? 23 : 68,
        motif: motifs[i % motifs.length],
      })),
      goal: { x: 234, y: 69 },
    };
  if (template === "metroidvania")
    return {
      ...common,
      world: { width: 260, height: 100 },
      movement: {
        runSpeed: 250,
        jumpVelocity: 490,
        doubleJumpVelocity: 440,
        dashSpeed: 650,
        dashDurationMs: 150,
        dashCooldownMs: 500,
        invulnerabilityMs: 220,
        wallSlideSpeed: 95,
        wallJumpX: 330,
        wallJumpY: 470,
      },
      combat: {
        meleeCombo: [1, 1, 2],
        comboWindowMs: 360,
        meleeRange: 72,
        plasmaDamage: 1,
        plasmaEnergyCost: 20,
        maxEnergy: 100,
        energyRechargePerSecond: 16,
      },
      platforms: [
        { x: 0, y: 86, w: 42 },
        { x: 47, y: 74, w: 30 },
        { x: 82, y: 61, w: 26 },
        { x: 113, y: 79, w: 31 },
        { x: 149, y: 60, w: 31 },
        { x: 185, y: 75, w: 29 },
        { x: 219, y: 57, w: 27 },
        { x: 248, y: 82, w: 12 },
      ],
      hazards: [
        { id: "toxic-pool", type: "liquid", x: 42, y: 91, w: 5 },
        { id: "spike-bank", type: "spikes", x: 108, y: 83, w: 5 },
        { id: "laser-a", type: "laser", x: 178, y: 58, w: 2, cycleMs: 1800 },
      ],
      checkpoints: [
        { id: "terminal-a", x: 72, y: 69 },
        { id: "terminal-b", x: 199, y: 70 },
      ],
      interactables: [
        { id: "gate-a", type: "gate", x: 88, y: 53, requires: "double_jump" },
        { id: "gate-b", type: "gate", x: 196, y: 67, requires: "grapple" },
        { id: "plate-a", type: "pressure_plate", x: 132, y: 75, target: "gate-b" },
        { id: "crate-a", type: "breakable_crate", x: 64, y: 68, contains: "energy" },
        { id: "crate-b", type: "breakable_crate", x: 165, y: 54, contains: "energy" },
      ],
      enemies: [
        { id: "drone-a", type: "patrol_drone", x: 58, y: 48, hp: 2, range: 230 },
        { id: "scrapper-a", type: "scrapper_bot", x: 126, y: 69, hp: 3, range: 190 },
        { id: "turret-a", type: "turret", x: 205, y: 40, hp: 2, fireEveryMs: 3000 },
      ],
      rooms: [
        "Forgotten Gate",
        "Echo Cavern",
        "Canopy Shaft",
        "Sunken Archive",
        "Sealed Core",
      ],
      abilities: [
        { id: "double_jump", x: 48, label: "Double jump" },
        { id: "grapple", x: 142, label: "Grapple hook" },
      ],
      gates: [
        { x: 88, requires: "double_jump" },
        { x: 196, requires: "grapple" },
      ],
      relics: [32, 118, 225],
      boss: { x: 242, hp: 5 },
    };
  if (template === "roguelike")
    return {
      ...common,
      dungeon: { size: 5, seed, floor: 1 },
      enemies: Array.from({ length: 6 }, (_, i) => ({
        x: (seed >> (i * 3)) % 5,
        y: (seed >> (i * 4 + 2)) % 5,
        hp: 1 + (i % 2),
      })),
      drops: ["swift boots", "ember blade", "shield seed", "lucky charm"],
      permadeath: true,
    };
  if (template === "shooter")
    return {
      ...common,
      arena: { width: 100, height: 100, waves: 3 },
      enemies: Array.from({ length: 8 }, (_, i) => ({
        x: 62 + (i % 4) * 9,
        y: 18 + Math.floor(i / 4) * 28,
        hp: 1,
        type: i % 3 === 0 ? "turret" : "drone",
      })),
      boss: { x: 84, y: 46, hp: 8 },
      fireRate: 240,
    };
  if (template === "snake")
    return {
      ...common,
      grid: { cols: 18, rows: 14 },
      snake: {
        start: [
          { x: 5, y: 7 },
          { x: 4, y: 7 },
          { x: 3, y: 7 },
        ],
        speedMs: 180,
      },
      food: { x: 13, y: 7 },
      walls: [],
    };
  if (template === "falling_blocks")
    return {
      ...common,
      board: { cols: 10, rows: 18 },
      pieces: ["I", "O", "T", "L", "J", "S", "Z"],
      gravityMs: 650,
      scoring: { line: 100, double: 300, triple: 500, quad: 800 },
    };
  if (template === "tank")
    return {
      ...common,
      arena: { width: 100, height: 100 },
      cover: [
        { x: 25, y: 22, w: 8, h: 28 },
        { x: 55, y: 55, w: 22, h: 8 },
        { x: 78, y: 18, w: 7, h: 24 },
      ],
      enemies: [
        { x: 82, y: 22, hp: 2 },
        { x: 76, y: 72, hp: 2 },
        { x: 45, y: 28, hp: 2 },
      ],
      shells: { speed: 12, cooldownMs: 350 },
      lives: 3,
    };
  if (template === "tennis")
    return {
      ...common,
      court: { width: 100, height: 100 },
      targetScore: 5,
      paddle: { speed: 8, height: 24 },
      ball: { speed: 1.8, start: { x: 50, y: 50 } },
      opponent: { difficulty: "adaptive", speed: 1.35 },
    };
  if (template === "racing")
    return {
      ...common,
      track: { lanes: 3, laps: 3, checkpoints: [15, 40, 65, 90] },
      vehicle: { acceleration: 0.7, maxSpeed: 9, grip: 0.82 },
      opponents: [
        { lane: 0, speed: 5.2 },
        { lane: 2, speed: 5.6 },
      ],
      hazards: [
        { lane: 1, progress: 36 },
        { lane: 0, progress: 72 },
      ],
    };
  if (template === "strategy")
    return {
      ...common,
      grid: { cols: 12, rows: 8 },
      resources: { start: 120, income: 10 },
      units: [
        { id: "guard", cost: 35, hp: 4, damage: 1 },
        { id: "archer", cost: 50, hp: 2, damage: 2 },
      ],
      waves: [3, 5, 8],
      core: { hp: 10 },
    };
  if (template === "rpg")
    return {
      ...common,
      stats: { level: 1, xp: 0, hp: 10, attack: 2 },
      inventory: ["healing herb"],
      quests: [{ id: "first_relic", goal: 3, reward: "forest key" }],
      dialogue: [
        { speaker: "Guide", text: "The path changes with every choice." },
      ],
      enemies: [{ type: "wisp", hp: 3, xp: 4 }],
    };
  if (template === "card")
    return {
      ...common,
      deck: [
        "strike",
        "guard",
        "spark",
        "mend",
        "focus",
        "dash",
        "echo",
        "ward",
      ],
      handSize: 4,
      energy: 3,
      opponent: { hp: 20, deck: "adaptive" },
      rules: { turnBased: true, drawPerTurn: 1 },
    };
  if (template === "simulation")
    return {
      ...common,
      clock: { day: 1, speed: 1 },
      resources: { coins: 100, reputation: 0 },
      stations: [{ id: "workbench", level: 1, output: 5 }],
      customers: { interval: 8, demand: ["basic", "quality", "rare"] },
      upgrades: [
        { id: "speed", cost: 80 },
        { id: "quality", cost: 120 },
      ],
    };
  if (template === "narrative")
    return {
      ...common,
      startNode: "arrival",
      nodes: {
        arrival: {
          text: "A sealed message waits at the crossing.",
          choices: [
            { label: "Open it", next: "truth" },
            { label: "Hide it", next: "shadow" },
          ],
        },
        truth: { text: "The truth changes the town.", ending: "hope" },
        shadow: { text: "The secret follows you home.", ending: "mystery" },
      },
      flags: [],
    };
  if (template === "puzzle")
    return {
      ...common,
      puzzle: {
        size: 3,
        initial: Array.from(
          { length: 9 },
          (_, index) => ((seed >> index) & 1) === 1,
        ),
        rule: "toggle_cross",
      },
    };
  return {
    ...common,
    obstacles: [
      { x: 22, y: 35, w: 14, h: 10 },
      { x: 60, y: 46, w: 18, h: 9 },
      { x: 35, y: 72, w: 12, h: 8 },
    ],
    collectibles: [
      { x: 14, y: 25 },
      { x: 78, y: 30 },
      { x: 74, y: 74 },
    ],
    npc: { x: 86, y: 61, name: `${art.hero} Guide` },
  };
}

export function validateGameSpec(spec) {
  const errors = [];
  const contract = validateContract(spec);
  if (!contract.success)
    errors.push(
      ...contract.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
    );
  if (spec?.schemaVersion !== "1.0.0")
    errors.push("Unsupported schema version");
  if (
    ![
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
    ].includes(spec?.template)
  )
    errors.push("Unknown template");
  if (!spec?.title || !spec?.objective || !Array.isArray(spec?.art?.palette))
    errors.push("Missing core game fields");
  if (
    spec?.template === "top_down" &&
    (!spec.obstacles || !spec.collectibles || !spec.npc)
  )
    errors.push("Incomplete top-down world");
  if (
    spec?.template === "platformer" &&
    (!spec.platforms || !spec.collectibles || !spec.goal)
  )
    errors.push("Incomplete platformer world");
  if (
    spec?.template === "metroidvania" &&
    (!spec.rooms || !spec.abilities || !spec.gates)
  )
    errors.push("Incomplete metroidvania world");
  if (
    spec?.template === "roguelike" &&
    (!spec.dungeon || !spec.enemies || !spec.permadeath)
  )
    errors.push("Incomplete roguelike run");
  if (
    spec?.template === "shooter" &&
    (!spec.arena || !spec.enemies || !spec.boss)
  )
    errors.push("Incomplete shooter arena");
  if (
    spec?.template === "snake" &&
    (!spec.grid || spec?.snake?.start?.length < 3 || !spec.food)
  )
    errors.push("Incomplete snake board");
  if (
    spec?.template === "falling_blocks" &&
    (!spec.board || spec?.pieces?.length !== 7 || !spec.scoring)
  )
    errors.push("Incomplete falling-block board");
  if (
    spec?.template === "tank" &&
    (!spec.arena || !spec.cover || !spec.enemies || !spec.shells)
  )
    errors.push("Incomplete tank arena");
  if (
    spec?.template === "tennis" &&
    (!spec.court || !spec.paddle || !spec.ball || !spec.targetScore)
  )
    errors.push("Incomplete tennis court");
  if (
    spec?.template === "racing" &&
    (!spec.track || !spec.vehicle || !spec.opponents)
  )
    errors.push("Incomplete racing track");
  if (
    spec?.template === "strategy" &&
    (!spec.grid || !spec.resources || !spec.units || !spec.waves)
  )
    errors.push("Incomplete strategy kit");
  if (
    spec?.template === "rpg" &&
    (!spec.stats || !spec.inventory || !spec.quests || !spec.dialogue)
  )
    errors.push("Incomplete RPG kit");
  if (
    spec?.template === "card" &&
    (!spec.deck || !spec.handSize || !spec.energy || !spec.opponent)
  )
    errors.push("Incomplete card kit");
  if (
    spec?.template === "simulation" &&
    (!spec.clock || !spec.resources || !spec.stations || !spec.upgrades)
  )
    errors.push("Incomplete simulation kit");
  if (
    spec?.template === "narrative" &&
    (!spec.startNode || !spec.nodes || !spec.flags)
  )
    errors.push("Incomplete narrative kit");
  if (spec?.template === "puzzle" && spec?.puzzle?.initial?.length !== 9)
    errors.push("Incomplete puzzle board");
  return { valid: errors.length === 0, errors };
}

export function togglePuzzle(board, index, size = 3) {
  const next = [...board];
  const row = Math.floor(index / size);
  const col = index % size;
  [
    [row, col],
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ].forEach(([r, c]) => {
    if (r >= 0 && r < size && c >= 0 && c < size)
      next[r * size + c] = !next[r * size + c];
  });
  return next;
}
