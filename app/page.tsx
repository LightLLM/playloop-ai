"use client";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  compileGameSpec,
  GameSpec,
  GameTemplate,
  togglePuzzle,
  validateGameSpec,
} from "./game-engine.mjs";
import { createBody, respawnBody, stepPhysics } from "./physics-engine.mjs";

type Step = "prompt" | "auth" | "plan" | "building" | "ready";
type BuildEvent = {
  agent: string;
  status: string;
  summary: string;
  progress: number;
  artifact?: any;
  jobId?: string;
};
const labels: Record<GameTemplate, string> = {
  top_down: "Top-down adventure",
  platformer: "Platformer",
  metroidvania: "Metroidvania",
  roguelike: "Roguelike",
  puzzle: "Puzzle / puzzle-platformer",
  shooter: "Run & gun / shmup",
  snake: "Snake arcade",
  falling_blocks: "Falling-block puzzle",
  tank: "Tank battle",
  tennis: "Tennis",
  racing: "Racing",
  strategy: "Strategy / tactics",
  rpg: "Role-playing game",
  card: "Card / deckbuilder",
  simulation: "Simulation / management",
  narrative: "Narrative / visual novel",
};

function PixelHero({
  kind = "hero",
  avatar = "explorer",
}: {
  kind?: "hero" | "npc";
  avatar?: string;
}) {
  return (
    <div className={`engine-sprite ${kind} avatar-${avatar}`}>
      <i className="s-hair" />
      <i className="s-face" />
      <i className="s-body" />
      <i className="s-feet" />
      <i className="s-detail" />
    </div>
  );
}

function TopDown({
  spec,
  onProgress,
}: {
  spec: GameSpec;
  onProgress: (p: any) => void;
}) {
  const [pos, setPos] = useState(spec.player.start);
  const [found, setFound] = useState<number[]>([]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const moves: Record<string, [number, number]> = {
        ArrowUp: [0, -6],
        w: [0, -6],
        ArrowDown: [0, 6],
        s: [0, 6],
        ArrowLeft: [-6, 0],
        a: [-6, 0],
        ArrowRight: [6, 0],
        d: [6, 0],
      };
      if (moves[e.key]) {
        e.preventDefault();
        move(...moves[e.key]);
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [found]);
  function move(dx: number, dy: number) {
    setPos((p: any) => {
      const n = {
        x: Math.max(4, Math.min(92, p.x + dx)),
        y: Math.max(15, Math.min(82, p.y + dy)),
      };
      const hit = spec.obstacles.some(
        (o: any) =>
          n.x > o.x - 4 &&
          n.x < o.x + o.w + 2 &&
          n.y > o.y - 6 &&
          n.y < o.y + o.h + 3,
      );
      const result = hit ? p : n;
      const collected = spec.collectibles
        .map((c: any, i: number) =>
          Math.hypot(result.x - c.x, result.y - c.y) < 9 ? i : -1,
        )
        .filter((i: number) => i >= 0);
      setFound((old) => [...new Set([...old, ...collected])]);
      onProgress({
        player: result,
        found: [...new Set([...found, ...collected])],
      });
      return result;
    });
  }
  return (
    <>
      <div
        className="engine-world topdown"
        style={
          {
            "--p1": spec.art.palette[0],
            "--p2": spec.art.palette[1],
            "--p3": spec.art.palette[2],
          } as React.CSSProperties
        }
      >
        <div className="parallax-stars" />
        <div className="engine-mountains" />
        {spec.obstacles.map((o: any, i: number) => (
          <div
            key={i}
            className="world-rock"
            style={{
              left: `${o.x}%`,
              top: `${o.y}%`,
              width: `${o.w}%`,
              height: `${o.h}%`,
            }}
          />
        ))}
        {spec.collectibles.map(
          (c: any, i: number) =>
            !found.includes(i) && (
              <div
                key={i}
                className="engine-gem"
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
              >
                ✦
              </div>
            ),
        )}
        <div
          className="world-npc"
          style={{ left: `${spec.npc.x}%`, top: `${spec.npc.y}%` }}
        >
          <PixelHero kind="npc" />
          <em>!</em>
        </div>
        <div
          className="world-player"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        >
          <PixelHero />
        </div>
      </div>
      <GameControls move={move} />
      <p className="runtime-status">
        Relics {found.length}/3{" "}
        {found.length === 3 ? "· Quest complete!" : "· Explore and collect"}
      </p>
    </>
  );
}

function Platformer({
  spec,
  onProgress,
}: {
  spec: GameSpec;
  onProgress: (p: any) => void;
}) {
  const worldWidth = spec.world.width || 240,
    [body, setBody] = useState(() => createBody({ x: 8, y: 72 })),
    bodyRef = useRef(body),
    input = useRef({ left: false, right: false, jump: false }),
    [found, setFound] = useState<number[]>([]),
    [defeated, setDefeated] = useState<number[]>([]),
    [health, setHealth] = useState(3),
    [checkpoint, setCheckpoint] = useState({ x: 8, y: 82 }),
    invulnerable = useRef(0);
  const total = spec.collectibles.length,
    camera = Math.max(0, Math.min(worldWidth - 100, body.x - 28));
  bodyRef.current = body;
  useEffect(() => {
    let frame = 0,
      last = performance.now(),
      accumulator = 0;
    const tick = (now: number) => {
      accumulator += Math.min(0.05, (now - last) / 1000);
      last = now;
      while (accumulator >= 1 / 60) {
        const activeEnemies = spec.enemies.filter(
          (_: any, i: number) => !defeated.includes(i),
        );
        const result = stepPhysics(
          bodyRef.current,
          input.current,
          { ...spec, enemies: activeEnemies },
          1 / 60,
        );
        input.current.jump = false;
        let next = result.body;
        invulnerable.current = Math.max(0, invulnerable.current - 1 / 60);
        if (
          (result.events.hazard || result.events.enemy >= 0) &&
          invulnerable.current === 0
        ) {
          invulnerable.current = 1;
          setHealth((h) => {
            if (h <= 1) {
              next = respawnBody(checkpoint);
              return 3;
            }
            return h - 1;
          });
        }
        if (result.events.fell) next = respawnBody(checkpoint);
        bodyRef.current = next;
        setBody(next);
        const hits = spec.collectibles
          .map((c: any, i: number) =>
            Math.hypot(next.x - c.x, next.y - c.y) < 8 ? i : -1,
          )
          .filter((i: number) => i >= 0);
        if (hits.length) setFound((old) => [...new Set([...old, ...hits])]);
        const cp = spec.checkpoints.find(
          (c: any) => Math.abs(next.x - c.x) < 5 && Math.abs(next.y - c.y) < 18,
        );
        if (cp) setCheckpoint({ x: cp.x, y: cp.y });
        accumulator -= 1 / 60;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [defeated, checkpoint, spec]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (["ArrowLeft", "a"].includes(e.key)) input.current.left = true;
      if (["ArrowRight", "d"].includes(e.key)) input.current.right = true;
      if (["ArrowUp", "w", " "].includes(e.key)) input.current.jump = true;
      if (["x", "Enter"].includes(e.key)) attack();
    };
    const up = (e: KeyboardEvent) => {
      if (["ArrowLeft", "a"].includes(e.key)) input.current.left = false;
      if (["ArrowRight", "d"].includes(e.key)) input.current.right = false;
    };
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    return () => {
      removeEventListener("keydown", down);
      removeEventListener("keyup", up);
    };
  }, [defeated]);
  useEffect(
    () => onProgress({ body, found, defeated, health, checkpoint }),
    [body, found, defeated, health, checkpoint],
  );
  function pulse(key: "left" | "right" | "jump") {
    input.current[key] = true;
    if (key !== "jump") setTimeout(() => (input.current[key] = false), 220);
  }
  function attack() {
    const b = bodyRef.current,
      hit = spec.enemies
        .map((e: any, i: number) =>
          Math.abs(b.x - e.x) < 9 && Math.abs(b.y - e.y) < 12 ? i : -1,
        )
        .filter((i: number) => i >= 0);
    setDefeated((old) => [...new Set([...old, ...hit])]);
  }
  return (
    <>
      <div className="level-hud">
        <span>♥ {health}/3</span>
        <span>
          ✦ {found.length}/{total}
        </span>
        <span>{body.grounded ? "GROUNDED" : "AIRBORNE"}</span>
      </div>
      <div
        className="engine-world platformer rich-level"
        style={
          {
            "--p1": spec.art.palette[0],
            "--p2": spec.art.palette[1],
            "--p3": spec.art.palette[2],
          } as React.CSSProperties
        }
      >
        <div
          className="level-stage"
          style={{
            width: `${worldWidth}%`,
            transform: `translateX(-${camera}%)`,
          }}
        >
          <div className="platform-sky" />
          <div className="forest-depth depth-one" />
          <div className="forest-depth depth-two" />
          {spec.decorations.map((d: any, i: number) => (
            <div
              key={`d${i}`}
              className={`level-decoration motif-${d.motif}`}
              style={{ left: `${(d.x / worldWidth) * 100}%`, top: `${d.y}%` }}
            >
              <i />
              <b />
            </div>
          ))}
          {spec.platforms.map((p: any, i: number) => (
            <div
              className="platform lush"
              key={i}
              style={{
                left: `${(p.x / worldWidth) * 100}%`,
                top: `${p.y}%`,
                width: `${(p.w / worldWidth) * 100}%`,
              }}
            >
              <i />
            </div>
          ))}
          {spec.hazards.map((h: any, i: number) => (
            <div
              className="spikes"
              key={`h${i}`}
              style={{
                left: `${(h.x / worldWidth) * 100}%`,
                top: "80%",
                width: `${(h.w / worldWidth) * 100}%`,
              }}
            />
          ))}
          {spec.checkpoints.map((c: any, i: number) => (
            <div
              className={`checkpoint ${checkpoint.x === c.x ? "active" : ""}`}
              key={`c${i}`}
              style={{
                left: `${(c.x / worldWidth) * 100}%`,
                top: `${c.y - 12}%`,
              }}
            >
              ⚑
            </div>
          ))}
          {spec.collectibles.map(
            (c: any, i: number) =>
              !found.includes(i) && (
                <div
                  className="engine-gem"
                  key={i}
                  style={{
                    left: `${(c.x / worldWidth) * 100}%`,
                    top: `${c.y}%`,
                  }}
                >
                  ◆
                </div>
              ),
          )}
          {spec.enemies.map(
            (e: any, i: number) =>
              !defeated.includes(i) && (
                <div
                  className={`level-enemy ${e.type}`}
                  key={`e${i}`}
                  style={{
                    left: `${(e.x / worldWidth) * 100}%`,
                    top: `${e.y}%`,
                  }}
                >
                  <i />
                  <b />
                </div>
              ),
          )}
          <div
            className="portal"
            style={{
              left: `${(spec.goal.x / worldWidth) * 100}%`,
              top: `${spec.goal.y}%`,
            }}
          />
          <div
            className={`platform-player ${invulnerable.current > 0 ? "hit" : ""}`}
            style={{
              left: `${(body.x / worldWidth) * 100}%`,
              top: `${body.y}%`,
              bottom: "auto",
            }}
          >
            <PixelHero avatar={spec.art.avatar} />
          </div>
        </div>
      </div>
      <div className="platform-controls">
        <button onClick={() => pulse("left")}>← Move</button>
        <button onClick={() => pulse("jump")}>↑ Jump</button>
        <button className="attack-control" onClick={attack}>
          ⚔ Attack
        </button>
        <button onClick={() => pulse("right")}>Move →</button>
      </div>
      <p className="runtime-status">
        {found.length === total && body.x > worldWidth - 12
          ? "Level complete!"
          : "Physics active · land on platforms, avoid spikes, and do not fall."}
      </p>
    </>
  );
}

function Puzzle({
  spec,
  onProgress,
}: {
  spec: GameSpec;
  onProgress: (p: any) => void;
}) {
  const [board, setBoard] = useState<boolean[]>(spec.puzzle.initial);
  const solved = board.every((v) => !v);
  function press(i: number) {
    const next = togglePuzzle(board, i);
    setBoard(next);
    onProgress({ board: next });
  }
  return (
    <>
      <div
        className="engine-world puzzle"
        style={
          {
            "--p1": spec.art.palette[0],
            "--p2": spec.art.palette[1],
            "--p3": spec.art.palette[2],
          } as React.CSSProperties
        }
      >
        <div className="puzzle-temple">
          <div className="puzzle-grid">
            {board.map((lit, i) => (
              <button
                aria-label={`Crystal ${i + 1}`}
                className={lit ? "lit" : ""}
                onClick={() => press(i)}
                key={i}
              >
                <i />
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="runtime-status">
        {solved
          ? "Vault unlocked · Puzzle complete!"
          : "Pressing a crystal also changes its neighbors"}
      </p>
    </>
  );
}

function GameControls({ move }: { move: (x: number, y: number) => void }) {
  return (
    <div className="engine-controls">
      <button onClick={() => move(0, -6)}>↑</button>
      <button onClick={() => move(-6, 0)}>←</button>
      <button onClick={() => move(0, 6)}>↓</button>
      <button onClick={() => move(6, 0)}>→</button>
    </div>
  );
}

function Metroidvania({
  spec,
  onProgress,
}: {
  spec: GameSpec;
  onProgress: (p: any) => void;
}) {
  const [x, setX] = useState(5),
    [abilities, setAbilities] = useState<string[]>([]),
    [relics, setRelics] = useState<number[]>([]),
    [bossHp, setBossHp] = useState(spec.boss.hp);
  const move = (d: number) => {
    let n = Math.max(0, Math.min(250, x + d));
    const gate = spec.gates.find(
      (g: any) => x < g.x && n >= g.x && !abilities.includes(g.requires),
    );
    if (gate) n = gate.x - 3;
    const got = spec.abilities
      .filter((a: any) => Math.abs(n - a.x) < 7)
      .map((a: any) => a.id);
    const powers = [...new Set([...abilities, ...got])];
    const rs = spec.relics
      .map((r: number, i: number) => (Math.abs(n - r) < 7 ? i : -1))
      .filter((i: number) => i >= 0);
    const all = [...new Set([...relics, ...rs])];
    setX(n);
    setAbilities(powers);
    setRelics(all);
    onProgress({ x: n, abilities: powers, relics: all, bossHp });
  };
  const attack = () => {
    if (x > 230 && abilities.length === 2)
      setBossHp((h: number) => Math.max(0, h - 1));
  };
  return (
    <>
      <div className="genre-hud">
        <span>ABILITIES {abilities.length}/2</span>
        <span>RELICS {relics.length}/3</span>
        <span>CORE {bossHp > 0 ? `LOCKED · ${bossHp} HP` : "OPEN"}</span>
      </div>
      <div
        className={`engine-world metro-world ${spec.theme === "cyber" ? "curated-neon" : ""}`}
        style={
          {
            "--p1": spec.art.palette[0],
            "--p2": spec.art.palette[1],
            "--p3": spec.art.palette[2],
          } as React.CSSProperties
        }
      >
        <div className="metro-map">
          {spec.rooms.map((r: string, i: number) => (
            <div className="metro-room" key={r} style={{ left: `${i * 20}%` }}>
              <b>{r}</b>
            </div>
          ))}
          {spec.gates.map((g: any, i: number) => (
            <div
              className={`ability-gate ${abilities.includes(g.requires) ? "open" : ""}`}
              key={i}
              style={{ left: `${g.x / 2.6}%` }}
            >
              {abilities.includes(g.requires)
                ? "OPEN"
                : g.requires.replace("_", " ")}
            </div>
          ))}
          {spec.abilities.map((a: any) => (
            <div
              className="ability-pickup"
              key={a.id}
              style={{ left: `${a.x / 2.6}%` }}
            >
              {abilities.includes(a.id) ? "✓" : a.label}
            </div>
          ))}
          <div className="metro-boss" style={{ left: "93%" }}>
            {bossHp}
          </div>
          <div className="metro-player" style={{ left: `${x / 2.6}%` }}>
            {spec.theme === "cyber" ? (
              <div className="metro-curated-runner" aria-label="Neon Sentinel" />
            ) : (
              <PixelHero avatar={spec.art.avatar} />
            )}
          </div>
        </div>
      </div>
      <div className="platform-controls">
        <button onClick={() => move(-8)}>← Explore</button>
        <button onClick={() => move(8)}>Explore →</button>
        <button onClick={attack}>⚔ Strike</button>
      </div>
      <p className="runtime-status">
        Unlock abilities, backtrack through opened gates, and reach the sealed
        core.
      </p>
    </>
  );
}

function Roguelike({
  spec,
  onProgress,
}: {
  spec: GameSpec;
  onProgress: (p: any) => void;
}) {
  const [player, setPlayer] = useState({ x: 2, y: 4 }),
    [enemies, setEnemies] = useState(spec.enemies),
    [hp, setHp] = useState(3),
    [floor, setFloor] = useState(1),
    [upgrade, setUpgrade] = useState("");
  const move = (dx: number, dy: number) => {
    const n = {
      x: Math.max(0, Math.min(4, player.x + dx)),
      y: Math.max(0, Math.min(4, player.y + dy)),
    };
    const hit = enemies.find((e: any) => e.x === n.x && e.y === n.y);
    if (hit) {
      const health = hp - 1;
      if (health <= 0) {
        setPlayer({ x: 2, y: 4 });
        setEnemies(spec.enemies);
        setHp(3);
        setFloor(1);
        setUpgrade("");
        return;
      }
      setHp(health);
      return;
    }
    setPlayer(n);
    onProgress({ player: n, hp, floor, upgrade });
  };
  const attack = () => {
    const index = enemies.findIndex(
      (e: any) => Math.abs(e.x - player.x) + Math.abs(e.y - player.y) === 1,
    );
    if (index < 0) return;
    const next = enemies.filter((_: any, i: number) => i !== index);
    setEnemies(next);
    if (next.length === 0)
      setUpgrade(spec.drops[(spec.art.seed + floor) % spec.drops.length]);
  };
  const descend = () => {
    if (enemies.length) return;
    setFloor((f) => f + 1);
    setEnemies(
      spec.enemies.map((e: any, i: number) => ({
        ...e,
        x: (e.x + floor + i) % 5,
        y: (e.y + 2) % 5,
      })),
    );
    setPlayer({ x: 2, y: 4 });
  };
  return (
    <>
      <div className="genre-hud">
        <span>♥ {hp}</span>
        <span>FLOOR {floor}</span>
        <span>{upgrade || "NO UPGRADE"}</span>
      </div>
      <div
        className="engine-world rogue-world"
        style={
          {
            "--p1": spec.art.palette[0],
            "--p2": spec.art.palette[1],
            "--p3": spec.art.palette[2],
          } as React.CSSProperties
        }
      >
        <div className="dungeon-grid">
          {Array.from({ length: 25 }, (_, i) => (
            <div className="dungeon-tile" key={i} />
          ))}
          {enemies.map((e: any, i: number) => (
            <div
              className="dungeon-enemy"
              key={i}
              style={{ gridColumn: e.x + 1, gridRow: e.y + 1 }}
            >
              ☠
            </div>
          ))}
          <div
            className="dungeon-player"
            style={{ gridColumn: player.x + 1, gridRow: player.y + 1 }}
          >
            ◆
          </div>
        </div>
      </div>
      <GameControls move={move} />
      <div className="rogue-actions">
        <button onClick={attack}>⚔ Attack</button>
        <button disabled={enemies.length > 0} onClick={descend}>
          Descend ↓
        </button>
      </div>
      <p className="runtime-status">
        {enemies.length
          ? `${enemies.length} enemies remain · death resets the run`
          : "Floor clear · choose your upgrade and descend"}
      </p>
    </>
  );
}

function Shooter({
  spec,
  onProgress,
}: {
  spec: GameSpec;
  onProgress: (p: any) => void;
}) {
  const [pos, setPos] = useState({ x: 12, y: 50 }),
    [enemies, setEnemies] = useState(spec.enemies),
    [bossHp, setBossHp] = useState(spec.boss.hp),
    [shots, setShots] = useState(0),
    [hp, setHp] = useState(3);
  const move = (dx: number, dy: number) =>
    setPos((p) => ({
      x: Math.max(5, Math.min(88, p.x + dx)),
      y: Math.max(10, Math.min(85, p.y + dy)),
    }));
  const fire = () => {
    setShots((s) => s + 1);
    if (enemies.length) {
      const target = enemies.reduce((a: any, b: any) =>
        Math.hypot(b.x - pos.x, b.y - pos.y) <
        Math.hypot(a.x - pos.x, a.y - pos.y)
          ? b
          : a,
      );
      setEnemies(enemies.filter((e: any) => e !== target));
    } else setBossHp((h: number) => Math.max(0, h - 1));
    onProgress({ pos, shots: shots + 1, hp, bossHp });
  };
  return (
    <>
      <div className="genre-hud">
        <span>♥ {hp}</span>
        <span>WAVE TARGETS {enemies.length}</span>
        <span>BOSS HP {bossHp}</span>
      </div>
      <div
        className="engine-world shooter-world"
        style={
          {
            "--p1": spec.art.palette[0],
            "--p2": spec.art.palette[1],
            "--p3": spec.art.palette[2],
          } as React.CSSProperties
        }
      >
        <div className="bullet-stars" />
        {enemies.map((e: any, i: number) => (
          <div
            className={`shooter-enemy ${e.type}`}
            key={i}
            style={{ left: `${e.x}%`, top: `${e.y}%` }}
          >
            ◆<i />
          </div>
        ))}
        {!enemies.length && bossHp > 0 && (
          <div
            className="shooter-boss"
            style={{ left: `${spec.boss.x}%`, top: `${spec.boss.y}%` }}
          >
            {bossHp}
          </div>
        )}
        <div
          className="shot-stream"
          style={{ left: `${pos.x + 4}%`, top: `${pos.y + 3}%` }}
        />
        <div
          className="shooter-player"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        >
          <PixelHero avatar={spec.art.avatar} />
        </div>
      </div>
      <GameControls move={move} />
      <div className="rogue-actions">
        <button className="fire-button" onClick={fire}>
          ● FIRE
        </button>
      </div>
      <p className="runtime-status">
        {bossHp === 0
          ? "Guardian defeated!"
          : "Keep moving, clear the wave, then defeat the guardian."}
      </p>
    </>
  );
}

function SnakeGame({
  spec,
  onProgress,
}: {
  spec: GameSpec;
  onProgress: (p: any) => void;
}) {
  const [snake, setSnake] = useState(spec.snake.start),
    [food, setFood] = useState(spec.food),
    [dir, setDir] = useState({ x: 1, y: 0 }),
    [lost, setLost] = useState(false);
  const turn = (x: number, y: number) =>
    setDir((d) => (d.x === -x && d.y === -y ? d : { x, y }));
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const m: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        w: [0, -1],
        ArrowDown: [0, 1],
        s: [0, 1],
        ArrowLeft: [-1, 0],
        a: [-1, 0],
        ArrowRight: [1, 0],
        d: [1, 0],
      };
      if (m[e.key]) turn(...m[e.key]);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setSnake((body: any[]) => {
          if (lost) return body;
          const head = { x: body[0].x + dir.x, y: body[0].y + dir.y };
          if (
            head.x < 0 ||
            head.y < 0 ||
            head.x >= spec.grid.cols ||
            head.y >= spec.grid.rows ||
            body.some((p) => p.x === head.x && p.y === head.y)
          ) {
            setLost(true);
            return body;
          }
          const ate = head.x === food.x && head.y === food.y,
            next = [head, ...body];
          if (!ate) next.pop();
          else
            setFood({
              x: (food.x + 7 + next.length) % spec.grid.cols,
              y: (food.y + 5 + next.length) % spec.grid.rows,
            });
          onProgress({ score: next.length - 3, length: next.length });
          return next;
        }),
      spec.snake.speedMs,
    );
    return () => clearInterval(timer);
  }, [dir, food, lost]);
  const reset = () => {
    setSnake(spec.snake.start);
    setFood(spec.food);
    setDir({ x: 1, y: 0 });
    setLost(false);
  };
  return (
    <>
      <div className="genre-hud">
        <span>LENGTH {snake.length}</span>
        <span>SCORE {snake.length - 3}</span>
        <span>{lost ? "CRASHED" : "GROWING"}</span>
      </div>
      <div
        className="engine-world arcade-board snake-board"
        style={
          {
            gridTemplateColumns: `repeat(${spec.grid.cols},1fr)`,
            "--p2": spec.art.palette[1],
            "--p3": spec.art.palette[2],
          } as React.CSSProperties
        }
      >
        {Array.from({ length: spec.grid.cols * spec.grid.rows }, (_, i) => {
          const x = i % spec.grid.cols,
            y = Math.floor(i / spec.grid.cols),
            part = snake.findIndex((p: any) => p.x === x && p.y === y);
          return (
            <i
              key={i}
              className={
                part === 0
                  ? "snake-head"
                  : part > 0
                    ? "snake-body"
                    : food.x === x && food.y === y
                      ? "snake-food"
                      : ""
              }
            />
          );
        })}
      </div>
      <GameControls move={(x, y) => turn(Math.sign(x), Math.sign(y))} />
      {lost && (
        <div className="rogue-actions">
          <button onClick={reset}>Play again</button>
        </div>
      )}
      <p className="runtime-status">
        Eat fruit to grow. Avoid walls and your own trail.
      </p>
    </>
  );
}

function FallingBlocks({
  spec,
  onProgress,
}: {
  spec: GameSpec;
  onProgress: (p: any) => void;
}) {
  const cols = spec.board.cols,
    rows = spec.board.rows,
    [cells, setCells] = useState<number[]>([]),
    [piece, setPiece] = useState({ x: 4, y: 0 }),
    [score, setScore] = useState(0);
  const move = (dx: number, dy: number) =>
    setPiece((p) => {
      const x = Math.max(0, Math.min(cols - 1, p.x + dx)),
        y = p.y + dy,
        blocked = y >= rows || cells.includes(y * cols + x);
      if (blocked && dy > 0) {
        let next = [...cells, p.y * cols + p.x],
          cleared = 0;
        for (let r = rows - 1; r >= 0; r--)
          if (
            Array.from({ length: cols }, (_, c) =>
              next.includes(r * cols + c),
            ).every(Boolean)
          ) {
            next = next
              .filter((v) => Math.floor(v / cols) !== r)
              .map((v) => (Math.floor(v / cols) < r ? v + cols : v));
            cleared++;
            r++;
          }
        setCells(next);
        setScore((s) => s + cleared * spec.scoring.line);
        onProgress({
          score: score + cleared * spec.scoring.line,
          lines: cleared,
        });
        return { x: Math.floor(cols / 2), y: 0 };
      }
      return blocked ? p : { x, y };
    });
  useEffect(() => {
    const t = setInterval(() => move(0, 1), spec.gravityMs);
    return () => clearInterval(t);
  });
  return (
    <>
      <div className="genre-hud">
        <span>SCORE {score}</span>
        <span>7 PIECE SET</span>
        <span>CLEAR FULL LINES</span>
      </div>
      <div
        className="engine-world arcade-board blocks-board"
        style={
          {
            gridTemplateColumns: `repeat(${cols},1fr)`,
            "--p2": spec.art.palette[1],
            "--p3": spec.art.palette[2],
          } as React.CSSProperties
        }
      >
        {Array.from({ length: cols * rows }, (_, i) => (
          <i
            key={i}
            className={
              cells.includes(i) || i === piece.y * cols + piece.x
                ? "filled"
                : ""
            }
          />
        ))}
      </div>
      <div className="platform-controls">
        <button onClick={() => move(-1, 0)}>←</button>
        <button onClick={() => move(0, 1)}>↓ Drop</button>
        <button onClick={() => move(1, 0)}>→</button>
      </div>
      <p className="runtime-status">
        Stack falling pieces and complete horizontal lines.
      </p>
    </>
  );
}

function TankGame({
  spec,
  onProgress,
}: {
  spec: GameSpec;
  onProgress: (p: any) => void;
}) {
  const [pos, setPos] = useState({ x: 10, y: 72 }),
    [enemies, setEnemies] = useState(spec.enemies),
    [shots, setShots] = useState(0);
  const move = (dx: number, dy: number) =>
    setPos((p) => ({
      x: Math.max(4, Math.min(92, p.x + dx)),
      y: Math.max(8, Math.min(86, p.y + dy)),
    }));
  const fire = () => {
    setShots((s) => s + 1);
    setEnemies((es) => es.slice(1));
    onProgress({
      pos,
      shots: shots + 1,
      enemies: Math.max(0, enemies.length - 1),
    });
  };
  return (
    <>
      <div className="genre-hud">
        <span>ARMOR {spec.lives}</span>
        <span>ENEMIES {enemies.length}</span>
        <span>SHELLS {shots}</span>
      </div>
      <div className="engine-world tank-world">
        {spec.cover.map((c: any, i: number) => (
          <i
            className="tank-cover"
            key={i}
            style={{
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: `${c.w}%`,
              height: `${c.h}%`,
            }}
          />
        ))}
        {enemies.map((e: any, i: number) => (
          <b
            className="tank enemy-tank"
            key={i}
            style={{ left: `${e.x}%`, top: `${e.y}%` }}
          >
            ◆
          </b>
        ))}
        <b
          className="tank player-tank"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        >
          ▲
        </b>
      </div>
      <GameControls move={move} />
      <div className="rogue-actions">
        <button className="fire-button" onClick={fire}>
          FIRE SHELL
        </button>
      </div>
      <p className="runtime-status">
        {enemies.length
          ? "Use cover and destroy enemy armor."
          : "Arena cleared!"}
      </p>
    </>
  );
}

function TennisGame({
  spec,
  onProgress,
}: {
  spec: GameSpec;
  onProgress: (p: any) => void;
}) {
  const [paddle, setPaddle] = useState(40),
    [ball, setBall] = useState({ x: 50, y: 50, vx: 1.3, vy: 1 }),
    [score, setScore] = useState([0, 0]);
  useEffect(() => {
    const t = setInterval(
      () =>
        setBall((b) => {
          let n = { ...b, x: b.x + b.vx, y: b.y + b.vy };
          if (n.y < 5 || n.y > 91) n.vy *= -1;
          if (n.x < 7 && Math.abs(n.y - paddle) < 18) n.vx = Math.abs(n.vx);
          const ai = Math.max(12, Math.min(76, n.y - 12));
          if (n.x > 91 && Math.abs(n.y - ai) < 20) n.vx = -Math.abs(n.vx);
          if (n.x < 0 || n.x > 100) {
            const player = n.x > 100,
              next = score.map((s, i) => s + (i === (player ? 0 : 1) ? 1 : 0));
            setScore(next);
            onProgress({ score: next });
            return { x: 50, y: 50, vx: player ? -1.3 : 1.3, vy: 1 };
          }
          return n;
        }),
      28,
    );
    return () => clearInterval(t);
  }, [paddle, score]);
  const ai = Math.max(12, Math.min(76, ball.y - 12));
  return (
    <>
      <div className="genre-hud">
        <span>YOU {score[0]}</span>
        <span>FIRST TO {spec.targetScore}</span>
        <span>RIVAL {score[1]}</span>
      </div>
      <div className="engine-world tennis-court">
        <i className="court-net" />
        <i className="tennis-paddle left" style={{ top: `${paddle}%` }} />
        <i className="tennis-paddle right" style={{ top: `${ai}%` }} />
        <b
          className="tennis-ball"
          style={{ left: `${ball.x}%`, top: `${ball.y}%` }}
        />
      </div>
      <div className="platform-controls">
        <button onClick={() => setPaddle((v) => Math.max(5, v - 8))}>
          ↑ Up
        </button>
        <button onClick={() => setPaddle((v) => Math.min(72, v + 8))}>
          ↓ Down
        </button>
      </div>
      <p className="runtime-status">
        Track the ball and return it past your rival.
      </p>
    </>
  );
}

function RacingGame({
  spec,
  onProgress,
}: {
  spec: GameSpec;
  onProgress: (p: any) => void;
}) {
  const [lane, setLane] = useState(1),
    [distance, setDistance] = useState(0),
    [speed, setSpeed] = useState(3);
  const lap = Math.min(spec.track.laps, Math.floor(distance / 100) + 1);
  useEffect(() => {
    const t = setInterval(
      () =>
        setDistance((d) => {
          const n = d + speed / 18;
          onProgress({
            distance: n,
            lap: Math.min(spec.track.laps, Math.floor(n / 100) + 1),
            speed,
          });
          return n;
        }),
      50,
    );
    return () => clearInterval(t);
  }, [speed]);
  return (
    <>
      <div className="genre-hud">
        <span>
          LAP {lap}/{spec.track.laps}
        </span>
        <span>SPEED {Math.round(speed * 20)}</span>
        <span>CHECKPOINT {Math.floor(distance % 100)}%</span>
      </div>
      <div className="engine-world race-world">
        <div className="road-lines" />
        <b className="race-car" style={{ left: `${26 + lane * 24}%` }}>
          ▲
        </b>
        {spec.opponents.map((o: any, i: number) => (
          <b
            className="race-car rival"
            key={i}
            style={{ left: `${26 + o.lane * 24}%`, top: `${22 + i * 25}%` }}
          >
            ▲
          </b>
        ))}
      </div>
      <div className="platform-controls">
        <button onClick={() => setLane((v) => Math.max(0, v - 1))}>
          ← Lane
        </button>
        <button
          onClick={() =>
            setSpeed((v) => Math.min(spec.vehicle.maxSpeed, v + 1))
          }
        >
          Accelerate
        </button>
        <button onClick={() => setSpeed((v) => Math.max(1, v - 1))}>
          Brake
        </button>
        <button onClick={() => setLane((v) => Math.min(2, v + 1))}>
          Lane →
        </button>
      </div>
      <p className="runtime-status">
        Pass checkpoints and complete all {spec.track.laps} laps.
      </p>
    </>
  );
}

function SandboxedPreview({
  src,
  onProgress,
}: {
  src: string;
  onProgress: (p: any) => void;
}) {
  const [health, setHealth] = useState("STARTING");
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.data?.source !== "playloop-preview") return;
      setHealth(
        event.data.type === "preview.ready"
          ? "RUNTIME HEALTHY"
          : event.data.type.replace("game.", "").toUpperCase(),
      );
      onProgress({ event: event.data.type, ...event.data.detail });
    };
    addEventListener("message", receive);
    return () => removeEventListener("message", receive);
  }, [onProgress]);
  return (
    <>
      <div className="sandbox-status">
        <span>ISOLATED PREVIEW</span>
        <b>{health}</b>
      </div>
      <iframe
        className="game-sandbox"
        title="Generated game preview"
        src={src}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
      />
    </>
  );
}

function VersionControls({
  jobId,
  qaStatus,
}: {
  jobId: string;
  qaStatus: string;
}) {
  const [versions, setVersions] = useState<any[]>([]),
    [published, setPublished] = useState<any>(null),
    [message, setMessage] = useState("");
  const load = () =>
    fetch(`/api/versions?jobId=${jobId}`)
      .then((r) => r.json())
      .then((v) => {
        setVersions(v.versions || []);
        setPublished(v.publication || null);
      });
  useEffect(() => {
    load();
  }, [jobId, qaStatus]);
  const act = async (action: string) => {
    const source = versions[0];
    if (!source) return;
    const response = await fetch("/api/versions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, jobId, versionId: source.id }),
      }),
      result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Operation failed");
      return;
    }
    setMessage(
      action === "publish"
        ? "Published immutable release."
        : action === "fork"
          ? `Fork created: ${result.jobId.slice(0, 8)}`
          : `Rolled back as version ${result.version}.`,
    );
    load();
  };
  return (
    <div className="version-panel">
      <div>
        <b>BUILD HISTORY</b>
        <span>
          {versions.length
            ? `${versions.length} immutable version${versions.length === 1 ? "" : "s"}`
            : "Loading…"}
        </span>
        {published && (
          <a href={`/api/published?slug=${published.slug}`} target="_blank">
            Published release ↗
          </a>
        )}
      </div>
      <div>
        <button onClick={() => act("rollback")}>Rollback</button>
        <button onClick={() => act("fork")}>Fork</button>
        <button
          className="publish"
          disabled={versions[0]?.qa_status !== "passed"}
          onClick={() => act("publish")}
        >
          {versions[0]?.qa_status === "passed" ? "Publish" : "QA required"}
        </button>
      </div>
      {message && <em>{message}</em>}
    </div>
  );
}

function Runtime({
  spec,
  onProgress,
}: {
  spec: GameSpec;
  onProgress: (p: any) => void;
}) {
  const generated = spec.art.generated || {};
  let game: React.ReactNode;
  if (spec.template === "platformer")
    game = <Platformer spec={spec} onProgress={onProgress} />;
  else if (spec.template === "metroidvania")
    game = <Metroidvania spec={spec} onProgress={onProgress} />;
  else if (spec.template === "roguelike")
    game = <Roguelike spec={spec} onProgress={onProgress} />;
  else if (spec.template === "shooter")
    game = <Shooter spec={spec} onProgress={onProgress} />;
  else if (spec.template === "snake")
    game = <SnakeGame spec={spec} onProgress={onProgress} />;
  else if (spec.template === "falling_blocks")
    game = <FallingBlocks spec={spec} onProgress={onProgress} />;
  else if (spec.template === "tank")
    game = <TankGame spec={spec} onProgress={onProgress} />;
  else if (spec.template === "tennis")
    game = <TennisGame spec={spec} onProgress={onProgress} />;
  else if (spec.template === "racing")
    game = <RacingGame spec={spec} onProgress={onProgress} />;
  else if (spec.template === "puzzle")
    game = <Puzzle spec={spec} onProgress={onProgress} />;
  else game = <TopDown spec={spec} onProgress={onProgress} />;
  return (
    <div
      className={`art-runtime ${generated.environment ? "has-generated-environment" : ""} ${generated.hero ? "has-generated-hero" : ""}`}
      style={
        {
          "--generated-environment": generated.environment
            ? `url("${generated.environment}")`
            : "none",
          "--generated-hero": generated.hero
            ? `url("${generated.hero}")`
            : "none",
        } as React.CSSProperties
      }
    >
      {game}
    </div>
  );
}

const agentPipeline = [
  {
    name: "Director Agent",
    task: "Interpreting genre, theme, and player goal",
    at: 5,
  },
  {
    name: "GameSpec Agent",
    task: "Writing entities, rules, objectives, and level data",
    at: 22,
  },
  {
    name: "Level Agent",
    task: "Placing platforms, rooms, hazards, gates, and encounters",
    at: 40,
  },
  {
    name: "Art Agent",
    task: "Building palette, character, prop, and environment manifests",
    at: 57,
  },
  {
    name: "Physics Agent",
    task: "Adding gravity, hitboxes, collisions, and respawn rules",
    at: 72,
  },
  {
    name: "QA Agent",
    task: "Validating schema, reachability, controls, and completion",
    at: 88,
  },
];
function AgentBuildWorkspace({
  spec,
  progress,
  compiler,
  events,
}: {
  spec: GameSpec | null;
  progress: number;
  compiler: string;
  events: BuildEvent[];
}) {
  return (
    <section className="agent-workspace">
      <div className="agent-pane">
        <div className="workspace-title">
          <span>SERVER ORCHESTRATION / AUDIT LOG</span>
          <i>LIVE</i>
        </div>
        <div className="agent-list">
          {agentPipeline.map((agent, index) => {
            const event = [...events]
                .reverse()
                .find((e) => e.agent === agent.name),
              done = event?.status === "completed",
              active = event?.status === "running";
            return (
              <div
                className={`agent-row ${done ? "done" : active ? "active" : "waiting"}`}
                key={agent.name}
              >
                <b>{done ? "✓" : active ? "●" : index + 1}</b>
                <div>
                  <strong>{agent.name}</strong>
                  <span>{event?.summary || agent.task}</span>
                  {event?.artifact && (
                    <code>{JSON.stringify(event.artifact).slice(0, 120)}</code>
                  )}
                </div>
                <em>{done ? "DONE" : active ? "RUNNING" : "QUEUED"}</em>
              </div>
            );
          })}
        </div>
        <div className="code-stream">
          <span>
            VERIFIABLE OUTPUT ·{" "}
            {events[0]?.jobId
              ? `JOB ${events[0].jobId.slice(0, 8)}`
              : "STARTING"}
          </span>
          <pre>
            {events.length
              ? events
                  .map(
                    (e) =>
                      `[${e.status.toUpperCase()}] ${e.agent}: ${e.summary}`,
                  )
                  .join("\n")
              : "// Waiting for server events…"}
          </pre>
        </div>
      </div>
      <div className="preview-pane">
        <div className="workspace-title">
          <span>GAME PREVIEW</span>
          <i>{progress < 100 ? "BUILDING" : "READY"}</i>
        </div>
        <div
          className="preview-canvas"
          style={
            {
              "--preview-a": spec?.art.palette[0] || "#182034",
              "--preview-b": spec?.art.palette[1] || "#59647a",
              "--preview-c": spec?.art.palette[2] || "#c9ff54",
            } as React.CSSProperties
          }
        >
          <div className="preview-sky" />
          <div className="preview-platform p-a" />
          <div className="preview-platform p-b" />
          <div className="preview-platform p-c" />
          <div className="preview-hero">
            <PixelHero avatar={spec?.art.avatar} />
          </div>
          <div className="preview-gem">◆</div>
          <div className="scanline" style={{ width: `${progress}%` }} />
        </div>
        <div className="preview-meta">
          <strong>{spec?.title || "Generating world…"}</strong>
          <span>{spec ? labels[spec.template] : "Selecting engine"}</span>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>("prompt"),
    [prompt, setPrompt] = useState(""),
    [template, setTemplate] = useState<"auto" | GameTemplate>("auto"),
    [progress, setProgress] = useState(0),
    [spec, setSpec] = useState<GameSpec | null>(null),
    [gameId, setGameId] = useState<string | null>(null),
    [shareToken, setShareToken] = useState<string | null>(null),
    [readOnly, setReadOnly] = useState(false),
    [authState, setAuthState] = useState<"checking" | "ready" | "signin">(
      "checking",
    ),
    [playState, setPlayState] = useState<any>({}),
    [notice, setNotice] = useState(""),
    [compiler, setCompiler] = useState<"openai" | "deterministic">(
      "deterministic",
    ),
    [buildEvents, setBuildEvents] = useState<BuildEvent[]>([]),
    [buildArtifact, setBuildArtifact] = useState<{
      jobId: string;
      versionId?: string;
      version: number;
      fingerprint: string;
      download: string;
      preview: string;
    } | null>(null),
    [assetStatus, setAssetStatus] = useState("pending"),
    [sandboxStatus, setSandboxStatus] = useState("pending");
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const detected = useMemo(
    () =>
      prompt.trim().length >= 10
        ? compileGameSpec(prompt, template).template
        : null,
    [prompt, template],
  );
  useEffect(() => {
    if (!buildArtifact) return;
    let cancelled = false;
    (async () => {
      setAssetStatus("generating");
      let latest: any = null,
        generated = 0;
      for (const kind of ["environment", "hero", "props", "spritesheet"]) {
        try {
          const response = await fetch("/api/assets", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jobId: buildArtifact.jobId, kind }),
          });
          if (response.ok) {
            latest = await response.json();
            const asset = latest;
            if (asset?.kind && asset?.url)
              setSpec((current) =>
                current
                  ? {
                      ...current,
                      art: {
                        ...current.art,
                        generated: {
                          ...(current.art.generated || {}),
                          [asset.kind]: asset.url,
                        },
                        provenance: {
                          ...(current.art.provenance || {}),
                          [asset.kind]: {
                            assetId: asset.id,
                            model: asset.model,
                            source: "openai-generated",
                            immutable: true,
                          },
                        },
                      },
                    }
                  : current,
              );
            generated++;
          }
        } catch {}
      }
      if (cancelled) return;
      setAssetStatus(
        generated === 4 ? "ready" : generated ? "partial" : "fallback",
      );
      if (latest?.version)
        setBuildArtifact((old) =>
          old
            ? {
                ...old,
                versionId: latest.versionId,
                version: latest.version,
                fingerprint: latest.fingerprint,
                preview: `/api/preview?id=${encodeURIComponent(old.jobId)}&version=${latest.version}`,
              }
            : old,
        );
      setSandboxStatus("compiling");
      try {
        const response = await fetch("/api/sandbox-build", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jobId: buildArtifact.jobId }),
          }),
          data = await response.json();
        if (!cancelled) {
          setSandboxStatus(response.ok ? "passed" : data.status || "failed");
          if (response.ok && data.artifact?.url)
            setBuildArtifact((old) =>
              old
                ? {
                    ...old,
                    versionId: data.artifact.versionId,
                    version: data.artifact.version || old.version,
                    preview: data.artifact.url,
                  }
                : old,
            );
        }
      } catch {
        if (!cancelled) setSandboxStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildArtifact?.jobId]);
  useEffect(() => {
    const q = new URLSearchParams(location.search),
      id = q.get("game"),
      share = q.get("share");
    if (!id) {
      if (q.has("continue")) {
        const draft = sessionStorage.getItem("playloop-draft");
        if (draft) {
          setPrompt(draft);
          setStep("auth");
        }
      }
      return;
    }
    fetch(
      `/api/games?id=${encodeURIComponent(id)}${share ? `&share=${encodeURIComponent(share)}` : ""}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        if (g?.spec) {
          setPrompt(g.prompt);
          setSpec(g.spec);
          setPlayState(g.progress || {});
          setGameId(g.id);
          setShareToken(g.shareToken || share);
          setReadOnly(!!g.readOnly);
          setStep("ready");
          if (!g.readOnly) {
            fetch(`/api/progress?gameId=${encodeURIComponent(g.id)}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((saved) => {
                if (saved)
                  setPlayState((old: any) => ({
                    ...old,
                    ...saved.progress,
                    highScore: saved.highScore,
                    achievements: saved.achievements,
                  }));
              })
              .catch(() => undefined);
          }
        }
      });
  }, []);
  useEffect(() => {
    if (step !== "auth") return;
    setAuthState("checking");
    fetch("/api/me")
      .then(async (r) => ({ ok: r.ok, data: await r.json() }))
      .then(({ ok, data }) =>
        setAuthState(
          ok && (data.authenticated || data.localDevelopment)
            ? "ready"
            : "signin",
        ),
      )
      .catch(() => setAuthState("signin"));
  }, [step]);
  useEffect(() => {
    if (
      !gameId ||
      readOnly ||
      !["game.victory", "game.failure"].includes(playState?.event)
    )
      return;
    const timer = setTimeout(() => {
      fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gameId,
          score: playState.score || 0,
          lastState: playState.event.replace("game.", ""),
          achievements: playState.achievements || [],
          progress: playState,
        }),
      }).catch(() => undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [gameId, playState, readOnly]);
  useEffect(() => {
    if (!gameId || readOnly) return;
    fetch(`/api/progress?gameId=${encodeURIComponent(gameId)}&leaderboard=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setLeaderboard(data?.leaderboard || []))
      .catch(() => undefined);
  }, [gameId, playState?.event, readOnly]);
  function submitPrompt(e: FormEvent) {
    e.preventDefault();
    if (prompt.trim().length >= 10) {
      sessionStorage.setItem("playloop-draft", prompt);
      setStep("auth");
    }
  }
  async function preparePlan(e?: FormEvent) {
    e?.preventDefault();
    setNotice("");
    try {
      const response = await fetch("/api/compile", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt, template }),
        }),
        result = await response.json();
      if (!response.ok || !result.spec)
        throw new Error(result.error || "Plan failed");
      if (!validateGameSpec(result.spec).valid)
        throw new Error("Plan validation failed");
      setSpec(result.spec);
      setCompiler(result.compiler || "deterministic");
      setStep("plan");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Plan failed");
    }
  }
  async function build(e?: FormEvent) {
    e?.preventDefault();
    setProgress(0);
    setBuildEvents([]);
    setBuildArtifact(null);
    setStep("building");
    try {
      const response = await fetch("/api/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, template, approvedSpec: spec }),
      });
      if (!response.ok || !response.body)
        throw new Error("Build stream unavailable");
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const packets = buffer.split("\n\n");
        buffer = packets.pop() || "";
        for (const packet of packets) {
          const line = packet.split("\n").find((v) => v.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6)) as BuildEvent;
          setBuildEvents((old) => [...old, event]);
          setProgress(event.progress);
          if (
            event.agent === "Orchestrator" &&
            event.status === "completed" &&
            event.artifact?.spec
          ) {
            const made = event.artifact.spec;
            if (!validateGameSpec(made).valid)
              throw new Error("Invalid GameSpec");
            setSpec(made);
            setCompiler(event.artifact.compiler || "deterministic");
            if (event.artifact.build) setBuildArtifact(event.artifact.build);
            setTimeout(() => setStep("ready"), 700);
          }
        }
      }
    } catch {
      const made =
        spec && validateGameSpec(spec).valid
          ? spec
          : compileGameSpec(prompt, template);
      setSpec(made);
      setCompiler("deterministic");
      setProgress(100);
      setBuildEvents((old) => [
        ...old,
        {
          agent: "Orchestrator",
          status: "completed",
          summary: "Recovered with validated local compiler.",
          progress: 100,
          artifact: { spec: made, compiler: "deterministic" },
        },
      ]);
      setTimeout(() => setStep("ready"), 700);
    }
  }
  async function save() {
    if (!spec) return;
    const r = await fetch("/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: readOnly ? undefined : gameId,
        prompt,
        spec,
        progress: playState,
      }),
    });
    if (!r.ok) {
      setNotice(
        r.status === 401
          ? "Sign in with ChatGPT to save."
          : "Save failed. Try again.",
      );
      return;
    }
    const g = await r.json();
    setGameId(g.id);
    setShareToken(g.shareToken);
    setReadOnly(false);
    if (playState?.event) {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gameId: g.id,
          score: playState.score || playState.highScore || 0,
          lastState: String(playState.event).replace("game.", ""),
          achievements: playState.achievements || [],
          progress: playState,
        }),
      }).catch(() => undefined);
    }
    setNotice(
      readOnly
        ? "A private copy is now saved to your account."
        : "Game and progress saved.",
    );
  }
  async function share() {
    if (!gameId || !shareToken) {
      await save();
      setNotice("Saved. Press Share once more to send the protected link.");
      return;
    }
    const url = `${location.origin}/?game=${encodeURIComponent(gameId)}&share=${encodeURIComponent(shareToken)}`;
    if (navigator.share)
      await navigator
        .share({ title: spec?.title, text: "Play my PlayLoop game!", url })
        .catch(() => {});
    else {
      await navigator.clipboard.writeText(url);
      setNotice("Protected share link copied!");
    }
  }
  return (
    <main className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setStep("prompt")}>
          <span className="brand-mark">P</span>PlayLoop
        </button>
        <span className="alpha">GAMESPEC ENGINE 1.0</span>
      </header>
      {step === "prompt" && (
        <section className="prompt-screen">
          <div className="prompt-content">
            <p className="kicker">
              <span /> 16 GENRE KITS · UNLIMITED WORLDS
            </p>
            <h1>
              Describe your next
              <br />
              2D game.
            </h1>
            <p className="intro">
              Write naturally. The compiler creates a validated world,
              mechanics, objectives, and pixel-art direction.
            </p>
            <form className="prompt-box" onSubmit={submitPrompt}>
              <textarea
                autoFocus
                spellCheck
                value={prompt}
                onChange={(e) => setPrompt(e.currentTarget.value)}
                placeholder="A platform adventure where a moon fox jumps between floating ruins and collects lost stars..."
              />
              <div className="template-row">
                <label>
                  GAME TYPE
                  <select
                    value={template}
                    onChange={(e) => setTemplate(e.target.value as any)}
                  >
                    <option value="auto">Auto-detect</option>
                    {Object.entries(labels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <span>
                  {detected
                    ? `Engine: ${labels[detected]}`
                    : "Describe your idea to select an engine"}
                </span>
                <button disabled={prompt.trim().length < 10}>
                  Compile game →
                </button>
              </div>
            </form>
          </div>
        </section>
      )}
      {step === "auth" && (
        <section className="auth-screen">
          <div className="auth-card">
            <button className="back" onClick={() => setStep("prompt")}>
              ← Edit idea
            </button>
            <p className="kicker">
              <span /> SAVE YOUR GENERATED WORLD
            </p>
            <h2>Continue securely</h2>
            <p>
              Your games, progress, generated artwork, and releases stay
              attached to your signed-in identity.
            </p>
            {authState === "checking" ? (
              <button className="auth-submit" disabled>
                Checking sign-in…
              </button>
            ) : authState === "signin" ? (
              <a
                className="auth-submit"
                href="/signin-with-chatgpt?return_to=%2F%3Fcontinue%3D1"
              >
                Sign in with ChatGPT →
              </a>
            ) : (
              <button className="auth-submit" onClick={() => preparePlan()}>
                Generate approved plan →
              </button>
            )}
            {notice && <div className="notice">{notice}</div>}
          </div>
        </section>
      )}
      {step === "plan" && spec && (
        <section className="plan-screen">
          <div className="plan-card">
            <p className="kicker">
              <span /> PLAN AWAITING APPROVAL
            </p>
            <h2>{spec.title}</h2>
            <p>{spec.objective}</p>
            <div className="plan-grid">
              <article>
                <b>ENGINE</b>
                <strong>{labels[spec.template]}</strong>
              </article>
              <article>
                <b>ACTIONS</b>
                <strong>{spec.gameLoop.actions.join(" · ")}</strong>
              </article>
              <article>
                <b>SCENES</b>
                <strong>{spec.scenes.join(" → ")}</strong>
              </article>
              <article>
                <b>PROGRESSION</b>
                <strong>
                  {spec.progression.levels} levels ·{" "}
                  {spec.progression.difficulty}
                </strong>
              </article>
              <article>
                <b>ART DIRECTION</b>
                <strong>
                  {spec.theme} · {spec.art.style.replaceAll("_", " ")}
                </strong>
              </article>
              <article>
                <b>QA TARGET</b>
                <strong>
                  {spec.testing.minFps} FPS ·{" "}
                  {spec.testing.expectedStates.length} states
                </strong>
              </article>
            </div>
            <div className="plan-actions">
              <button onClick={() => setStep("prompt")}>Revise prompt</button>
              <button className="approve" onClick={() => build()}>
                Approve & build →
              </button>
            </div>
          </div>
        </section>
      )}
      {step === "building" && (
        <AgentBuildWorkspace
          spec={spec}
          progress={progress}
          compiler={compiler}
          events={buildEvents}
        />
      )}
      {step === "ready" && spec && (
        <section className="ready-screen">
          <div className="ready-head">
            <div>
              <p className="kicker">
                <span /> {labels[spec.template].toUpperCase()}
              </p>
              <h2>{spec.title}</h2>
              <p className="spec-objective">{spec.objective}</p>
              {buildArtifact && (
                <p className="build-fingerprint">
                  IMMUTABLE BUILD v{buildArtifact.version} ·{" "}
                  {buildArtifact.fingerprint}
                </p>
              )}
              {(playState.highScore || playState.achievements?.length) && (
                <p className="build-fingerprint">
                  HIGH SCORE {playState.highScore || playState.score || 0} ·
                  ACHIEVEMENTS {(playState.achievements || []).length}
                </p>
              )}
              {buildArtifact && (
                <p className="build-fingerprint">
                  ART {assetStatus.toUpperCase()} · ISOLATED QA{" "}
                  {sandboxStatus.toUpperCase()}
                </p>
              )}
              {assetStatus === "ready" && (
                <p className="build-fingerprint">
                  ART PROVENANCE VERIFIED · OPENAI GENERATED · MODERATED ·
                  IMMUTABLE
                </p>
              )}
              {assetStatus !== "ready" && (
                <p className="build-fingerprint">
                  ART SOURCE · PROMPT-DERIVED PROCEDURAL PIXEL ENGINE · SEEDED ·
                  NETWORK-INDEPENDENT
                </p>
              )}
            </div>
            <div className="ready-actions">
              <button className="save-button" onClick={save}>
                {readOnly ? "Save a copy" : "Save game"}
              </button>
              {!readOnly && (
                <button className="share-button" onClick={share}>
                  Share ↗
                </button>
              )}
              {buildArtifact && (
                <a className="export-button" href={buildArtifact.download}>
                  Download Phaser ZIP
                </a>
              )}
              <button onClick={() => setStep("prompt")}>New game</button>
            </div>
          </div>
          {notice && <div className="notice">{notice}</div>}
          {buildArtifact && (
            <VersionControls
              jobId={buildArtifact.jobId}
              qaStatus={sandboxStatus}
            />
          )}
          <div className="game-frame">
            <div className="game-hud">
              <span>✦ {spec.art.hero.toUpperCase()}</span>
              <span>
                {labels[spec.template].toUpperCase()} · GAMESPEC{" "}
                {spec.schemaVersion}
              </span>
            </div>
            {buildArtifact ? (
              <SandboxedPreview
                src={buildArtifact.preview}
                onProgress={setPlayState}
              />
            ) : (
              <Runtime spec={spec} onProgress={setPlayState} />
            )}
          </div>
          {leaderboard.length > 0 && (
            <section
              className="version-panel"
              aria-label="High-score leaderboard"
            >
              <div className="version-heading">
                <strong>HIGH SCORES</strong>
                <span>TOP {leaderboard.length}</span>
              </div>
              <div className="version-list">
                {leaderboard.slice(0, 10).map((entry) => (
                  <div
                    className="version-row"
                    key={`${entry.rank}-${entry.updatedAt}`}
                  >
                    <span>#{entry.rank}</span>
                    <b>{entry.highScore}</b>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>
      )}
    </main>
  );
}
