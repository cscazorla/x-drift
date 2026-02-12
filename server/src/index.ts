import { WebSocketServer, WebSocket } from 'ws';
import {
  MessageType,
  SERVER_PORT,
  TICK_RATE,
  type ClientMessage,
  type PlayerState,
  type StateMessage,
  type WelcomeMessage,
} from '@x-drift/shared';

// ---- Player tracking ----

interface Player {
  id: string;
  ws: WebSocket;
  x: number;
  y: number;
  z: number;
  keys: Record<string, boolean>;
}

const players = new Map<string, Player>();
let nextId = 1;

// ---- WebSocket server ----

const wss = new WebSocketServer({ port: SERVER_PORT });

wss.on('connection', (ws) => {
  const id = String(nextId++);
  const player: Player = { id, ws, x: 0, y: 0, z: 0, keys: {} };
  players.set(id, player);

  const welcome: WelcomeMessage = { type: MessageType.Welcome, playerId: id };
  ws.send(JSON.stringify(welcome));

  console.log(`Player ${id} connected (${players.size} online)`);

  ws.on('message', (raw) => {
    try {
      const msg: ClientMessage = JSON.parse(String(raw));
      if (msg.type === MessageType.Input) {
        player.keys = msg.keys;
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    players.delete(id);
    console.log(`Player ${id} disconnected (${players.size} online)`);
  });
});

// ---- Game loop ----

const SPEED = 5; // units per second
const dt = 1 / TICK_RATE;

function tick() {
  for (const player of players.values()) {
    if (player.keys['w'] || player.keys['ArrowUp']) player.z -= SPEED * dt;
    if (player.keys['s'] || player.keys['ArrowDown']) player.z += SPEED * dt;
    if (player.keys['a'] || player.keys['ArrowLeft']) player.x -= SPEED * dt;
    if (player.keys['d'] || player.keys['ArrowRight']) player.x += SPEED * dt;
  }

  const playerStates: PlayerState[] = [];
  for (const p of players.values()) {
    playerStates.push({ id: p.id, x: p.x, y: p.y, z: p.z });
  }

  const stateMsg: StateMessage = {
    type: MessageType.State,
    players: playerStates,
  };
  const payload = JSON.stringify(stateMsg);

  for (const player of players.values()) {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(payload);
    }
  }
}

setInterval(tick, 1000 / TICK_RATE);

console.log(`X-Drift server listening on ws://localhost:${SERVER_PORT}`);
