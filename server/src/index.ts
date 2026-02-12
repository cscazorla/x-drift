import { WebSocketServer, WebSocket } from 'ws';
import {
  MessageType,
  SERVER_PORT,
  TICK_RATE,
  SHIP_SPEED,
  MOUSE_SENSITIVITY,
  MAX_PITCH,
  ROLL_SPEED,
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
  yaw: number;
  pitch: number;
  roll: number;
  keys: Record<string, boolean>;
  /** Accumulated mouse deltas (summed between ticks) */
  mouseDx: number;
  mouseDy: number;
}

const players = new Map<string, Player>();
let nextId = 1;

// ---- WebSocket server ----

const wss = new WebSocketServer({ port: SERVER_PORT });

wss.on('connection', (ws) => {
  const id = String(nextId++);
  const player: Player = {
    id,
    ws,
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    keys: {},
    mouseDx: 0,
    mouseDy: 0,
  };
  players.set(id, player);

  const welcome: WelcomeMessage = { type: MessageType.Welcome, playerId: id };
  ws.send(JSON.stringify(welcome));

  console.log(`Player ${id} connected (${players.size} online)`);

  ws.on('message', (raw) => {
    try {
      const msg: ClientMessage = JSON.parse(String(raw));
      if (msg.type === MessageType.Input) {
        player.keys = msg.keys;
        // Accumulate mouse deltas — multiple messages may arrive between ticks
        player.mouseDx += msg.mouseDx;
        player.mouseDy += msg.mouseDy;
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

const dt = 1 / TICK_RATE;

function tick() {
  for (const player of players.values()) {
    // 1. Apply mouse rotation
    player.yaw -= player.mouseDx * MOUSE_SENSITIVITY;
    player.pitch -= player.mouseDy * MOUSE_SENSITIVITY;
    player.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, player.pitch));

    // Reset accumulated mouse deltas
    player.mouseDx = 0;
    player.mouseDy = 0;

    // 2. Apply roll from A/D (visual only — does not affect forward vector)
    if (player.keys['a'] || player.keys['ArrowLeft']) player.roll += ROLL_SPEED * dt;
    if (player.keys['d'] || player.keys['ArrowRight']) player.roll -= ROLL_SPEED * dt;

    // 3. Compute forward vector from yaw + pitch
    const forwardX = -Math.sin(player.yaw) * Math.cos(player.pitch);
    const forwardY = Math.sin(player.pitch);
    const forwardZ = -Math.cos(player.yaw) * Math.cos(player.pitch);

    // 4. Apply thrust along forward vector
    if (player.keys['w'] || player.keys['ArrowUp']) {
      player.x += forwardX * SHIP_SPEED * dt;
      player.y += forwardY * SHIP_SPEED * dt;
      player.z += forwardZ * SHIP_SPEED * dt;
    }
    if (player.keys['s'] || player.keys['ArrowDown']) {
      player.x -= forwardX * SHIP_SPEED * dt;
      player.y -= forwardY * SHIP_SPEED * dt;
      player.z -= forwardZ * SHIP_SPEED * dt;
    }
  }

  // Broadcast state
  const playerStates: PlayerState[] = [];
  for (const p of players.values()) {
    playerStates.push({
      id: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      pitch: p.pitch,
      roll: p.roll,
    });
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
