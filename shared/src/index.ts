// ---- Protocol message types ----

export const enum MessageType {
  /** Client → Server: player input */
  Input = 'input',
  /** Server → Client: world state snapshot */
  State = 'state',
  /** Server → Client: player accepted into the game */
  Welcome = 'welcome',
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
}

// ---- Server → Client messages ----

export interface WelcomeMessage {
  type: MessageType.Welcome;
  playerId: string;
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
}

export interface StateMessage {
  type: MessageType.State;
  players: PlayerState[];
}

export type ServerMessage = WelcomeMessage | StateMessage;
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
