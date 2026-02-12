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
