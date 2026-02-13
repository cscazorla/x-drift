// ---- Protocol message types ----

export const enum MessageType {
  /** Client → Server: player input */
  Input = 'input',
  /** Server → Client: world state snapshot */
  State = 'state',
  /** Server → Client: player accepted into the game */
  Welcome = 'welcome',
  /** Server → Client: a projectile hit a ship */
  Hit = 'hit',
  /** Server → Client: a ship was destroyed */
  Kill = 'kill',
}

// ---- Client → Server messages ----

export interface InputMessage {
  type: MessageType.Input;
  seq: number;
  /** Keys currently pressed */
  keys: Record<string, boolean>;
  /** Accumulated mouse X delta since last message */
  mouseDx: number;
  /** Accumulated mouse Y delta since last message */
  mouseDy: number;
  /** True if the player wants to fire this tick */
  fire: boolean;
}

// ---- Celestial bodies ----

export interface CelestialBody {
  type: 'sun' | 'planet';
  x: number;
  y: number;
  z: number;
  radius: number;
  color: number;
  emissive?: number;
  ring?: {
    innerRadius: number;
    outerRadius: number;
    color: number;
  };
  atmosphere?: {
    color: number;
    opacity: number;
    scale: number;
  };
}

// ---- Projectile state ----

export interface ProjectileState {
  id: number;
  ownerId: string;
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
}

// ---- Server → Client messages ----

export interface WelcomeMessage {
  type: MessageType.Welcome;
  playerId: string;
  celestialBodies: CelestialBody[];
}

export interface PlayerState {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  speed: number;
  hp: number;
  kills: number;
  deaths: number;
  thrustState: 'idle' | 'forward' | 'brake';
}

export interface StateMessage {
  type: MessageType.State;
  players: PlayerState[];
  projectiles: ProjectileState[];
}

export interface HitMessage {
  type: MessageType.Hit;
  targetId: string;
  attackerId: string;
  projectileId: number;
  x: number;
  y: number;
  z: number;
}

export interface KillMessage {
  type: MessageType.Kill;
  targetId: string;
  attackerId: string;
  x: number;
  y: number;
  z: number;
}

export type ServerMessage = WelcomeMessage | StateMessage | HitMessage | KillMessage;
export type ClientMessage = InputMessage;

// ---- Constants ----

export const SERVER_PORT = 3000;
export const TICK_RATE = 60; // server ticks per second
export const MAX_SPEED = 10; // units per second (top speed)
export const ACCELERATION = 5; // units/second² when pressing W
export const BRAKE_FORCE = 8; // units/second² when pressing S
export const MOUSE_SENSITIVITY = 0.003;
export const MAX_PITCH = Math.PI / 3; // ±60°
export const ROLL_SPEED = 2; // radians per second

// Projectile constants
export const PROJECTILE_SPEED = 40; // units/second
export const PROJECTILE_LIFETIME = 3; // seconds
export const FIRE_COOLDOWN = 0.3; // seconds
export const PROJECTILE_HIT_RADIUS = 1; // units
export const MAX_PROJECTILES_PER_PLAYER = 10;

// Health / respawn constants
export const MAX_HP = 4;
export const RESPAWN_TIME = 5; // seconds

// HUD constants
export const SCOREBOARD_SIZE = 10;

// NPC constants
export const NPC_COUNT = 75;
export const NPC_TURN_RATE = 400;           // max mouse-delta units for steering
export const NPC_WANDER_INTERVAL_MIN = 2;   // seconds
export const NPC_WANDER_INTERVAL_MAX = 5;   // seconds
export const NPC_MIN_SKILL = 0.3;
export const NPC_MAX_SKILL = 1.0;
