import { WebSocketServer, WebSocket } from 'ws';
import {
  MessageType,
  SERVER_PORT,
  TICK_RATE,
  FIRE_COOLDOWN,
  type CelestialBody,
  type ClientMessage,
  type PlayerState,
  type ProjectileState,
  type StateMessage,
  type HitMessage,
  type WelcomeMessage,
} from '@x-drift/shared';
import {
  type Projectile,
  updatePlayerMovement,
  spawnProjectile,
  moveProjectiles,
  detectCollisions,
} from './game.js';

// ---- Celestial bodies ----

const celestialBodies: CelestialBody[] = [
  {
    type: 'sun',
    x: 300, y: 80, z: -200,
    radius: 30,
    color: 0xffaa00,
    emissive: 0xffdd44,
  },
  {
    type: 'planet',
    x: -250, y: -30, z: 150,
    radius: 12,
    color: 0x4477aa,
  },
  {
    type: 'planet',
    x: 100, y: 50, z: -350,
    radius: 18,
    color: 0xcc8844,
    ring: { innerRadius: 24, outerRadius: 34, color: 0xddaa66 },
  },
];

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
  speed: number;
  keys: Record<string, boolean>;
  mouseDx: number;
  mouseDy: number;
  fire: boolean;
  fireCooldown: number;
}

// ---- State ----

let projectiles: Projectile[] = [];
let nextProjectileId = 1;

const players = new Map<string, Player>();
let nextId = 1;

// ---- WebSocket server ----

const wss = new WebSocketServer({ port: SERVER_PORT });

wss.on('connection', (ws) => {
  const id = String(nextId++);
  const spawnAngle = Math.random() * 2 * Math.PI;
  const spawnRadius = 30 + Math.random() * 50;
  const sx = Math.cos(spawnAngle) * spawnRadius;
  const sy = (Math.random() - 0.5) * 40;
  const sz = Math.sin(spawnAngle) * spawnRadius;
  const sun = celestialBodies.find((b) => b.type === 'sun');
  const dx = (sun?.x ?? 0) - sx;
  const dy = (sun?.y ?? 0) - sy;
  const dz = (sun?.z ?? 0) - sz;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const player: Player = {
    id,
    ws,
    x: sx,
    y: sy,
    z: sz,
    yaw: Math.atan2(-dx, -dz),
    pitch: Math.atan2(dy, dist),
    roll: 0,
    speed: 0,
    keys: {},
    mouseDx: 0,
    mouseDy: 0,
    fire: false,
    fireCooldown: 0,
  };
  players.set(id, player);

  const welcome: WelcomeMessage = { type: MessageType.Welcome, playerId: id, celestialBodies };
  ws.send(JSON.stringify(welcome));

  console.log(`Player ${id} connected (${players.size} online)`);

  ws.on('message', (raw) => {
    try {
      const msg: ClientMessage = JSON.parse(String(raw));
      if (msg.type === MessageType.Input) {
        player.keys = msg.keys;
        player.mouseDx += msg.mouseDx;
        player.mouseDy += msg.mouseDy;
        if (msg.fire) player.fire = true;
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    players.delete(id);
    projectiles = projectiles.filter((p) => p.ownerId !== id);
    console.log(`Player ${id} disconnected (${players.size} online)`);
  });
});

// ---- Game loop ----
// Runs at 60 Hz. Each tick processes all player inputs, simulates the world,
// then broadcasts the result to every client:
//   1. A `state` message is ALWAYS sent — the full world snapshot (players + projectiles).
//   2. A `hit` message is sent ONLY when a projectile collides with a ship.

const dt = 1 / TICK_RATE;

function tick() {
  // --- Simulation phase ---

  // Apply accumulated input (mouse look, keys) and advance each player's position
  for (const player of players.values()) {
    updatePlayerMovement(player, dt);
  }

  // Spawn projectiles
  for (const player of players.values()) {
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    const count = projectiles.filter((p) => p.ownerId === player.id).length;
    const proj = spawnProjectile(player, count, nextProjectileId);
    if (proj) {
      projectiles.push(proj);
      nextProjectileId++;
      player.fireCooldown = FIRE_COOLDOWN;
    }
    player.fire = false;
  }

  // Move projectiles & expire
  projectiles = moveProjectiles(projectiles, dt);

  // Collision detection
  const targets = [...players.values()].map((p) => ({ id: p.id, x: p.x, y: p.y, z: p.z }));
  const { survivors, hits } = detectCollisions(projectiles, targets);
  projectiles = survivors;

  // --- Broadcast phase ---
  // Always: send a `state` message with every player's position/rotation and every live projectile.
  // Conditionally: if any collisions happened, also send a `hit` message per collision.

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
      speed: p.speed,
    });
  }

  const projectileStates: ProjectileState[] = projectiles.map((p) => ({
    id: p.id,
    ownerId: p.ownerId,
    x: p.x,
    y: p.y,
    z: p.z,
    dx: p.dx,
    dy: p.dy,
    dz: p.dz,
  }));

  const stateMsg: StateMessage = {
    type: MessageType.State,
    players: playerStates,
    projectiles: projectileStates,
  };
  const payload = JSON.stringify(stateMsg);
  const hitPayloads = hits.map((h) => JSON.stringify(h));

  // Send to all connected clients: state first, then any hit events
  for (const player of players.values()) {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(payload);
      for (const hp of hitPayloads) {
        player.ws.send(hp);
      }
    }
  }
}

setInterval(tick, 1000 / TICK_RATE);

console.log(`X-Drift server listening on ws://localhost:${SERVER_PORT}`);
