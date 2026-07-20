export type GameTemplate = "top_down" | "platformer" | "metroidvania" | "roguelike" | "puzzle" | "shooter" | "snake" | "falling_blocks" | "tank" | "tennis" | "racing" | "strategy" | "rpg" | "card" | "simulation" | "narrative";
export type GameSpec = Record<string, any> & { schemaVersion: "1.0.0"; id: string; title: string; prompt: string; template: GameTemplate; theme: string; objective: string; art: { palette: string[]; hero: string; avatar: string; motifs: string[]; seed: number; manifest: Record<string,string> }; player: { start: { x: number; y: number }; speed: number } };
export function inferTemplate(prompt: string, override?: "auto" | GameTemplate): GameTemplate;
export function compileGameSpec(prompt: string, override?: "auto" | GameTemplate): GameSpec;
export function validateGameSpec(spec: GameSpec): { valid: boolean; errors: string[] };
export function togglePuzzle(board: boolean[], index: number, size?: number): boolean[];
