import { z } from "zod";

const point=z.object({x:z.number(),y:z.number()});
export const GameSpecSchema=z.object({
  schemaVersion:z.literal("1.0.0"),id:z.string().min(4),title:z.string().min(1),prompt:z.string().min(10),
  template:z.enum(["top_down","platformer","metroidvania","roguelike","puzzle","shooter","snake","falling_blocks","tank","tennis","racing","strategy","rpg","card","simulation","narrative"]),
  theme:z.string().min(1),objective:z.string().min(1),audience:z.enum(["family","teen","general"]),
  viewport:z.object({width:z.number().int().positive(),height:z.number().int().positive(),orientation:z.enum(["landscape","portrait"]),scaling:z.literal("fit"),mobileControls:z.boolean()}),
  gameLoop:z.object({goal:z.string(),actions:z.array(z.string()).min(1),failure:z.string(),victory:z.string(),restart:z.string()}),
  scenes:z.array(z.enum(["preload","menu","tutorial","gameplay","pause","results"])).min(4),
  progression:z.object({levels:z.number().int().positive(),difficulty:z.enum(["steady","rising","adaptive"]),scoring:z.string(),unlocks:z.array(z.string())}),
  persistence:z.object({saveProgress:z.boolean(),highScores:z.boolean(),settings:z.boolean()}),
  testing:z.object({requiredActions:z.array(z.string()).min(1),expectedStates:z.array(z.string()).min(3),maxLoadMs:z.number().positive(),minFps:z.number().positive()}),
  art:z.object({style:z.string(),palette:z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).length(3),hero:z.string(),avatar:z.string(),motifs:z.array(z.string()),seed:z.number(),manifest:z.record(z.string(),z.string())}),
  world:z.object({width:z.number().positive(),height:z.number().positive()}),player:z.object({start:point,speed:z.number().positive()}),
}).passthrough();

export function validateContract(value){return GameSpecSchema.safeParse(value)}
