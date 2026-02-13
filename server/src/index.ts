import { WebSocketServer, WebSocket } from 'ws';
import {
  MessageType,
  SERVER_PORT,
  TICK_RATE,
  MAX_SPEED,
  ACCELERATION,
  BRAKE_FORCE,
  MOUSE_SENSITIVITY,
  MAX_PITCH,
  ROLL_SPEED,
  PROJECTILE_SPEED,
  PROJECTILE_LIFETIME,
  FIRE_COOLDOWN,
  PROJECTILE_HIT_RADIUS,
  MAX_PROJECTILES_PER_PLAYER,
  type CelestialBody,
  type ClientMessage,
  type PlayerState,
  type ProjectileState,
  type StateMessage,
  type HitMessage,
  type WelcomeMessage,
} from '@x-drift/shared';

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
  /** Accumulated mouse deltas (summed between ticks) */
  mouseDx: number;
  mouseDy: number;
  /** True if any input since last tick requested fire */
  fire: boolean;
  fireCooldown: number;
}

// ---- Projectile tracking ----

interface Projectile {
  id: number;
  ownerId: string;
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  age: number;
}

const projectiles: Projectile[] = [];
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
        // Accumulate mouse deltas — multiple messages may arrive between ticks
        player.mouseDx += msg.mouseDx;
        player.mouseDy += msg.mouseDy;
        // Sticky fire: if any message between ticks says fire, the player fires
        if (msg.fire) player.fire = true;
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    players.delete(id);
    // Remove all projectiles owned by this player
    for (let i = projectiles.length - 1; i >= 0; i--) {
      if (projectiles[i].ownerId === id) projectiles.splice(i, 1);
    }
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
    const rollingLeft = player.keys['a'] || player.keys['ArrowLeft'];
    const rollingRight = player.keys['d'] || player.keys['ArrowRight'];
    if (rollingLeft) player.roll += ROLL_SPEED * dt;
    else if (rollingRight) player.roll -= ROLL_SPEED * dt;
    else player.roll *= Math.pow(0.05, dt); // lerp toward 0

    // 3. Compute forward vector from yaw + pitch
    const forwardX = -Math.sin(player.yaw) * Math.cos(player.pitch);
    const forwardY = Math.sin(player.pitch);
    const forwardZ = -Math.cos(player.yaw) * Math.cos(player.pitch);

    // 4. Update speed based on input (no friction — speed holds when coasting)
    if (player.keys['w'] || player.keys['ArrowUp']) {
      player.speed = Math.min(player.speed + ACCELERATION * dt, MAX_SPEED);
    } else if (player.keys['s'] || player.keys['ArrowDown']) {
      player.speed = Math.max(player.speed - BRAKE_FORCE * dt, 0);
    }

    // 5. Move along forward vector at current speed
    player.x += forwardX * player.speed * dt;
    player.y += forwardY * player.speed * dt;
    player.z += forwardZ * player.speed * dt;
  }

  // ---- Spawn projectiles ----
  for (const player of players.values()) {
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    if (player.fire && player.fireCooldown <= 0) {
      // Count live projectiles for this player
      let count = 0;
      for (const p of projectiles) {
        if (p.ownerId === player.id) count++;
      }
      if (count < MAX_PROJECTILES_PER_PLAYER) {
        const fx = -Math.sin(player.yaw) * Math.cos(player.pitch);
        const fy = Math.sin(player.pitch);
        const fz = -Math.cos(player.yaw) * Math.cos(player.pitch);
        projectiles.push({
          id: nextProjectileId++,
          ownerId: player.id,
          x: player.x + fx * 0.95,
          y: player.y + fy * 0.95,
          z: player.z + fz * 0.95,
          dx: fx,
          dy: fy,
          dz: fz,
          age: 0,
        });
        player.fireCooldown = FIRE_COOLDOWN;
      }
    }
    player.fire = false;
  }

  // ---- Move projectiles & expire ----
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.dx * PROJECTILE_SPEED * dt;
    p.y += p.dy * PROJECTILE_SPEED * dt;
    p.z += p.dz * PROJECTILE_SPEED * dt;
    p.age += dt;
    if (p.age >= PROJECTILE_LIFETIME) {
      projectiles.splice(i, 1);
    }
  }

  // ---- Collision detection ----
  const hitMessages: HitMessage[] = [];
  const hitRadiusSq = PROJECTILE_HIT_RADIUS * PROJECTILE_HIT_RADIUS;
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    for (const target of players.values()) {
      if (target.id === p.ownerId) continue; // skip self
      const dx = p.x - target.x;
      const dy = p.y - target.y;
      const dz = p.z - target.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq <= hitRadiusSq) {
        hitMessages.push({
          type: MessageType.Hit,
          targetId: target.id,
          projectileId: p.id,
          x: p.x,
          y: p.y,
          z: p.z,
        });
        projectiles.splice(i, 1);
        break;
      }
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
  const hitPayloads = hitMessages.map((h) => JSON.stringify(h));

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
