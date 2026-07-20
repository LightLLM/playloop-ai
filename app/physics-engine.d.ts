export type PhysicsBody={x:number;y:number;vx:number;vy:number;w:number;h:number;grounded:boolean;facing:number};
export const PHYSICS:Readonly<Record<string,number>>;
export function overlaps(a:{x:number;y:number;w:number;h:number},b:{x:number;y:number;w:number;h:number}):boolean;
export function createBody(start?:{x:number;y:number}):PhysicsBody;
export function stepPhysics(body:PhysicsBody,input:{left?:boolean;right?:boolean;jump?:boolean},world:any,dt?:number):{body:PhysicsBody;events:{fell:boolean;hazard:boolean;enemy:number}};
export function respawnBody(checkpoint:{x:number;y:number}):PhysicsBody;
