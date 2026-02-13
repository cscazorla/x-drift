import { WebSocketServer, WebSocket } from 'ws';
import {
  MessageType,
  SERVER_PORT,
  TICK_RATE,
  FIRE_COOLDOWN,
  MAX_HP,
  RESPAWN_TIME,
  type CelestialBody,
  type ClientMessage,
  type PlayerState,
  type ProjectileState,
  type StateMessage,
  type HitMessage,
  type KillMessage,
  type WelcomeMessage,
} from '@x-drift/shared';
import {
  type Projectile,
  updatePlayerMovement,
  spawnProjectile,
  moveProjectiles,
  detectCollisions,
  applyDamage,
} from './game.js';
import { type NPC, createAllNPCs, updateNPCAI, respawnNPC } from './npc.js';

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
  // Small red rocky planet — barren, no atmosphere or rings
  {
    type: 'planet',
    x: -80, y: 120, z: -500,
    radius: 6,
    color: 0xbb4422,
  },
  // Large gas giant with thick green atmosphere
  {
    type: 'planet',
    x: 450, y: -60, z: 300,
    radius: 25,
    color: 0x2a4a2a,
    atmosphere: { color: 0x44aa55, opacity: 0.2, scale: 1.12 },
  },
  // Tiny pale moon
  {
    type: 'planet',
    x: -400, y: 10, z: -100,
    radius: 4,
    color: 0xccccaa,
  },
  // Volcanic world — dark surface with fiery atmosphere
  {
    type: 'planet',
    x: 200, y: -120, z: 500,
    radius: 10,
    color: 0x332211,
    atmosphere: { color: 0xff4400, opacity: 0.12, scale: 1.15 },
  },
  // Golden desert world
  {
    type: 'planet',
    x: -350, y: 90, z: -400,
    radius: 15,
    color: 0xddaa33,
  },
  // Small purple planet with hazy atmosphere
  {
    type: 'planet',
    x: 380, y: 140, z: -150,
    radius: 8,
    color: 0x7733aa,
    atmosphere: { color: 0xaa66dd, opacity: 0.15, scale: 1.1 },
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
  hp: number;
  keys: Record<string, boolean>;
  mouseDx: number;
  mouseDy: number;
  fire: boolean;
  fireCooldown: number;
  respawnTimer: number;
  kills: number;
  deaths: number;
}

// ---- State ----

let projectiles: Projectile[] = [];
let nextProjectileId = 1;

const players = new Map<string, Player>();
let nextId = 1;
const npcs: NPC[] = createAllNPCs();
const npcRespawnTimers = new Map<string, number>();

// ---- Helpers ----

function randomSpawnPosition(): { x: number; y: number; z: number; yaw: number; pitch: number } {
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
  return { x: sx, y: sy, z: sz, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, dist) };
}

// ---- WebSocket server ----

const wss = new WebSocketServer({ port: SERVER_PORT });

wss.on('connection', (ws) => {
  const id = String(nextId++);
  const spawn = randomSpawnPosition();
  const player: Player = {
    id,
    ws,
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    yaw: spawn.yaw,
    pitch: spawn.pitch,
    roll: 0,
    speed: 0,
    hp: MAX_HP,
    keys: {},
    mouseDx: 0,
    mouseDy: 0,
    fire: false,
    fireCooldown: 0,
    respawnTimer: 0,
    kills: 0,
    deaths: 0,
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

  // 1. Movement: skip dead entities
  for (const player of players.values()) {
    if (player.hp > 0) updatePlayerMovement(player, dt);
  }

  // 2. NPC AI: skip dead NPCs
  for (const npc of npcs) {
    if (npc.hp > 0) {
      updateNPCAI(npc, dt);
      updatePlayerMovement(npc, dt);
    }
  }

  // 3. Spawn projectiles: skip dead players
  for (const player of players.values()) {
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    if (player.hp <= 0) { player.fire = false; continue; }
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

  // 4. Collision detection: only alive entities as targets
  const allEntities = [...players.values(), ...npcs];
  const aliveTargets = allEntities
    .filter((p) => p.hp > 0)
    .map((p) => ({ id: p.id, x: p.x, y: p.y, z: p.z }));
  const { survivors, hits } = detectCollisions(projectiles, aliveTargets);
  projectiles = survivors;

  // 5. Apply damage → get kills
  const kills = applyDamage(hits, allEntities);

  // Set respawn timers and update scores for newly killed entities
  const npcById = new Map(npcs.map((n) => [n.id, n]));
  for (const kill of kills) {
    const targetPlayer = players.get(kill.targetId);
    if (targetPlayer) {
      targetPlayer.respawnTimer = RESPAWN_TIME;
      targetPlayer.deaths += 1;
    } else {
      npcRespawnTimers.set(kill.targetId, RESPAWN_TIME);
      const targetNpc = npcById.get(kill.targetId);
      if (targetNpc) targetNpc.deaths += 1;
    }
    const attackerPlayer = players.get(kill.attackerId);
    if (attackerPlayer) {
      attackerPlayer.kills += 1;
    } else {
      const attackerNpc = npcById.get(kill.attackerId);
      if (attackerNpc) attackerNpc.kills += 1;
    }
  }

  // 6. Respawn timers
  for (const player of players.values()) {
    if (player.hp <= 0 && player.respawnTimer > 0) {
      player.respawnTimer -= dt;
      if (player.respawnTimer <= 0) {
        const spawn = randomSpawnPosition();
        player.x = spawn.x;
        player.y = spawn.y;
        player.z = spawn.z;
        player.yaw = spawn.yaw;
        player.pitch = spawn.pitch;
        player.roll = 0;
        player.speed = 0;
        player.hp = MAX_HP;
        player.respawnTimer = 0;
      }
    }
  }

  for (const npc of npcs) {
    const timer = npcRespawnTimers.get(npc.id);
    if (timer !== undefined && timer > 0) {
      const remaining = timer - dt;
      if (remaining <= 0) {
        respawnNPC(npc);
        npcRespawnTimers.delete(npc.id);
      } else {
        npcRespawnTimers.set(npc.id, remaining);
      }
    }
  }

  // --- Broadcast phase ---

  const playerStates: PlayerState[] = [];
  for (const p of allEntities) {
    const humanPlayer = players.get(p.id);
    const npc = npcById.get(p.id);
    playerStates.push({
      id: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      pitch: p.pitch,
      roll: p.roll,
      speed: p.speed,
      hp: p.hp,
      kills: humanPlayer?.kills ?? npc?.kills ?? 0,
      deaths: humanPlayer?.deaths ?? npc?.deaths ?? 0,
      thrustState: (p.keys['w'] || p.keys['ArrowUp']) ? 'forward' as const
        : (p.keys['s'] || p.keys['ArrowDown']) ? 'brake' as const
        : 'idle' as const,
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
  const killPayloads = kills.map((k) => JSON.stringify(k));

  for (const player of players.values()) {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(payload);
      for (const hp of hitPayloads) {
        player.ws.send(hp);
      }
      for (const kp of killPayloads) {
        player.ws.send(kp);
      }
    }
  }
}

setInterval(tick, 1000 / TICK_RATE);

console.log(`X-Drift server listening on ws://localhost:${SERVER_PORT}`);
