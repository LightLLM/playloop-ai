import type { GameSpec, GameTemplate } from "./game-engine.mjs";
export type AudioCue = "move" | "jump" | "fire" | "collect" | "interact" | "skill" | "hit" | "victory" | "failure";
export type AudioPlan = { version: "1.0.0"; seed: number; template: GameTemplate; theme: string; bpm: number; scale: string; leadWave: OscillatorType; bassWave: OscillatorType; ambience: string; rhythm: number[]; pattern: number[]; mix: Record<string,number>; cues: Record<AudioCue,{midi:number;duration:number}> };
export function compileAudioPlan(spec: GameSpec): AudioPlan;
export function deriveAudioCue(progress?: Record<string,any>): AudioCue | null;
export function createProceduralAudioEngine(plan: AudioPlan, target?: any): { plan: AudioPlan; start(): Promise<boolean>; pause(): Promise<void>; playCue(name: AudioCue): void; destroy(): Promise<void>; isEnabled(): boolean };
export const audioGenreProfiles: Readonly<Record<GameTemplate,unknown>>;
