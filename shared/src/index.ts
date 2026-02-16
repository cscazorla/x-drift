export { computeForward, normalizeAngle, distanceSq } from './math.js';

// ---- Protocol message types ----

export const enum MessageType {
  /** Client → Server: player input */
  Input = 'input',
  /** Client → Server: player chooses a team from lobby */
  JoinTeam = 'joinTeam',
  /** Server → Client: world state snapshot */
  State = 'state',
  /** Server → Client: player accepted into the game */
  Welcome = 'welcome',
  /** Server → Client: current team member counts (sent to lobby clients) */
  TeamInfo = 'teamInfo',
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

export interface JoinTeamMessage {
  type: MessageType.JoinTeam;
  team: number;
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
  playerName: string;
  celestialBodies: CelestialBody[];
}

export interface TeamInfoMessage {
  type: MessageType.TeamInfo;
  teams: [number, number];
  playerName?: string;
}

export interface PlayerState {
  id: string;
  name: string;
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
  team: number; // 0 = green, 1 = red
  heat: number;
  overheated: boolean;
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
  attackerName: string;
  targetName: string;
  attackerTeam: number;
  targetTeam: number;
  x: number;
  y: number;
  z: number;
}

export type ServerMessage =
  | WelcomeMessage
  | TeamInfoMessage
  | StateMessage
  | HitMessage
  | KillMessage;
export type ClientMessage = InputMessage | JoinTeamMessage;

// ---- Constants ----

export const SERVER_PORT = 3000;
export const TICK_RATE = 60; // server ticks per second
export const MAX_SPEED = 25; // units per second (top speed)
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
export const SHIP_COLLISION_RADIUS = 1.5; // units — ship-ship when 2×this, ship-body when body.radius + this
export const MAX_PROJECTILES_PER_PLAYER = 10;

// Health / respawn constants
export const MAX_HP = 4;
export const RESPAWN_TIME = 5; // seconds

// HUD constants
export const SCOREBOARD_SIZE = 10;

// NPC constants
export const NPC_COUNT = 75;
export const NPC_TURN_RATE = 400; // max mouse-delta units for steering
export const NPC_WANDER_INTERVAL_MIN = 2; // seconds
export const NPC_WANDER_INTERVAL_MAX = 5; // seconds
export const NPC_MIN_SKILL = 0.3;
export const NPC_MAX_SKILL = 1.0;
export const NPC_DETECTION_RANGE = 50;
export const NPC_MIN_COMBAT_RANGE = 5; // ignore targets closer than this to avoid deadlocks
export const NPC_MAX_SPEED_FACTOR = 0.7; // NPCs cap at 70% of MAX_SPEED
export const NPC_AIM_THRESHOLD_MIN = 0.15; // ~9 deg — skill=1.0 still needs decent aim
export const NPC_AIM_THRESHOLD_MAX = 0.5; // ~29 deg — skill=0.3 fires very loosely
export const NPC_FIRE_COOLDOWN = 0.8; // seconds — NPCs shoot slower than players (0.3)

// Heat / overheat constants
export const HEAT_PER_SHOT = 0.10; // heat added per shot
export const HEAT_DECAY_RATE = 0.20; // heat removed per second
export const OVERHEAT_THRESHOLD = 1.0; // heat level that triggers overheat lockout
export const OVERHEAT_RECOVERY = 0.0; // must cool fully before firing again
