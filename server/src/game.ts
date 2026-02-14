import {
  MessageType,
  MAX_SPEED,
  ACCELERATION,
  BRAKE_FORCE,
  MOUSE_SENSITIVITY,
  MAX_PITCH,
  ROLL_SPEED,
  PROJECTILE_SPEED,
  PROJECTILE_LIFETIME,
  PROJECTILE_HIT_RADIUS,
  SHIP_COLLISION_RADIUS,
  MAX_PROJECTILES_PER_PLAYER,
  HEAT_PER_SHOT,
  HEAT_DECAY_RATE,
  OVERHEAT_THRESHOLD,
  OVERHEAT_RECOVERY,
  type CelestialBody,
  type HitMessage,
  type KillMessage,
} from '@x-drift/shared';

// ---- Types ----

export interface Projectile {
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

/** Subset of Player fields needed by movement/projectile logic (no WebSocket). */
export interface PlayerLike {
  id: string;
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
  heat: number;
  overheated: boolean;
}

// ---- Pure functions ----

/** Compute a unit forward vector from yaw and pitch. */
export function computeForward(yaw: number, pitch: number): { x: number; y: number; z: number } {
  return {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
}

/** Apply mouse rotation, roll, speed and position updates to a player. Mutates in place. */
export function updatePlayerMovement(player: PlayerLike, dt: number): void {
  // 1. Apply mouse rotation
  player.yaw -= player.mouseDx * MOUSE_SENSITIVITY;
  player.pitch -= player.mouseDy * MOUSE_SENSITIVITY;
  player.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, player.pitch));

  // Reset accumulated mouse deltas
  player.mouseDx = 0;
  player.mouseDy = 0;

  // 2. Apply roll from A/D (visual only)
  const rollingLeft = player.keys.a || player.keys.ArrowLeft;
  const rollingRight = player.keys.d || player.keys.ArrowRight;
  if (rollingLeft) player.roll += ROLL_SPEED * dt;
  else if (rollingRight) player.roll -= ROLL_SPEED * dt;
  else player.roll *= Math.pow(0.05, dt); // lerp toward 0

  // 3. Compute forward vector
  const fwd = computeForward(player.yaw, player.pitch);

  // 4. Update speed
  if (player.keys.w || player.keys.ArrowUp) {
    player.speed = Math.min(player.speed + ACCELERATION * dt, MAX_SPEED);
  } else if (player.keys.s || player.keys.ArrowDown) {
    player.speed = Math.max(player.speed - BRAKE_FORCE * dt, 0);
  }

  // 5. Move along forward vector
  player.x += fwd.x * player.speed * dt;
  player.y += fwd.y * player.speed * dt;
  player.z += fwd.z * player.speed * dt;
}

/**
 * Try to spawn a projectile for a player.
 * Returns the new Projectile, or null if conditions aren't met.
 * Does NOT reset player.fire or player.fireCooldown — caller handles that.
 */
export function spawnProjectile(
  player: PlayerLike,
  projectileCount: number,
  nextId: number,
): Projectile | null {
  if (
    !player.fire ||
    player.fireCooldown > 0 ||
    player.overheated ||
    projectileCount >= MAX_PROJECTILES_PER_PLAYER
  ) {
    return null;
  }
  const fwd = computeForward(player.yaw, player.pitch);
  return {
    id: nextId,
    ownerId: player.id,
    x: player.x + fwd.x * 0.95,
    y: player.y + fwd.y * 0.95,
    z: player.z + fwd.z * 0.95,
    dx: fwd.x,
    dy: fwd.y,
    dz: fwd.z,
    age: 0,
  };
}

/** Move all projectiles by their direction * PROJECTILE_SPEED * dt, increment age, remove expired. */
export function moveProjectiles(projectiles: Projectile[], dt: number): Projectile[] {
  const survivors: Projectile[] = [];
  for (const p of projectiles) {
    p.x += p.dx * PROJECTILE_SPEED * dt;
    p.y += p.dy * PROJECTILE_SPEED * dt;
    p.z += p.dz * PROJECTILE_SPEED * dt;
    p.age += dt;
    if (p.age < PROJECTILE_LIFETIME) {
      survivors.push(p);
    }
  }
  return survivors;
}

/** Minimal target info needed for collision detection. */
export interface CollisionTarget {
  id: string;
  x: number;
  y: number;
  z: number;
  team: number;
}

/** Detect projectile–player collisions. Returns surviving projectiles and hit messages. */
export function detectCollisions(
  projectiles: Projectile[],
  targets: CollisionTarget[],
  teamByOwner?: Map<string, number>,
): { survivors: Projectile[]; hits: HitMessage[] } {
  const survivors: Projectile[] = [];
  const hits: HitMessage[] = [];
  const hitRadiusSq = PROJECTILE_HIT_RADIUS * PROJECTILE_HIT_RADIUS;

  for (const p of projectiles) {
    let hit = false;
    for (const target of targets) {
      if (target.id === p.ownerId) continue; // skip self
      // Skip same-team targets (friendly fire prevention)
      const ownerTeam = teamByOwner?.get(p.ownerId);
      if (ownerTeam !== undefined && target.team === ownerTeam) continue;
      const dx = p.x - target.x;
      const dy = p.y - target.y;
      const dz = p.z - target.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq <= hitRadiusSq) {
        hits.push({
          type: MessageType.Hit,
          targetId: target.id,
          attackerId: p.ownerId,
          projectileId: p.id,
          x: p.x,
          y: p.y,
          z: p.z,
        });
        hit = true;
        break;
      }
    }
    if (!hit) {
      survivors.push(p);
    }
  }
  return { survivors, hits };
}

/**
 * Apply damage from hit messages to entities. Returns KillMessages for any
 * entities whose hp reaches 0. Skips already-dead entities.
 */
export function applyDamage(
  hits: HitMessage[],
  entities: Map<string, PlayerLike> | PlayerLike[],
): KillMessage[] {
  const kills: KillMessage[] = [];
  const lookup =
    entities instanceof Map ? entities : new Map(Array.from(entities, (e) => [e.id, e]));

  for (const hit of hits) {
    const target = lookup.get(hit.targetId);
    if (!target || target.hp <= 0) continue;

    target.hp -= 1;
    if (target.hp <= 0) {
      target.speed = 0;
      kills.push({
        type: MessageType.Kill,
        targetId: hit.targetId,
        attackerId: hit.attackerId,
        attackerName: '',
        targetName: '',
        attackerTeam: -1,
        targetTeam: -1,
        x: target.x,
        y: target.y,
        z: target.z,
      });
    }
  }
  return kills;
}

/** Detect ship–ship collisions. Both ships die instantly. */
export function detectShipShipCollisions(entities: PlayerLike[]): KillMessage[] {
  const kills: KillMessage[] = [];
  const shipRadiusSq = 2 * SHIP_COLLISION_RADIUS * (2 * SHIP_COLLISION_RADIUS);

  for (let i = 0; i < entities.length; i++) {
    const a = entities[i];
    if (a.hp <= 0) continue;
    for (let j = i + 1; j < entities.length; j++) {
      const b = entities[j];
      if (b.hp <= 0) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dz = a.z - b.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq <= shipRadiusSq) {
        a.hp = 0;
        a.speed = 0;
        b.hp = 0;
        b.speed = 0;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const mz = (a.z + b.z) / 2;
        kills.push({
          type: MessageType.Kill,
          targetId: a.id,
          attackerId: b.id,
          attackerName: '',
          targetName: '',
          attackerTeam: -1,
          targetTeam: -1,
          x: mx,
          y: my,
          z: mz,
        });
        kills.push({
          type: MessageType.Kill,
          targetId: b.id,
          attackerId: a.id,
          attackerName: '',
          targetName: '',
          attackerTeam: -1,
          targetTeam: -1,
          x: mx,
          y: my,
          z: mz,
        });
      }
    }
  }
  return kills;
}

/** Detect ship–celestial-body collisions. Ship dies instantly. */
export function detectCelestialCollisions(
  entities: PlayerLike[],
  bodies: CelestialBody[],
): KillMessage[] {
  const kills: KillMessage[] = [];

  for (const entity of entities) {
    if (entity.hp <= 0) continue;
    for (const body of bodies) {
      const threshold = body.radius + SHIP_COLLISION_RADIUS;
      const dx = entity.x - body.x;
      const dy = entity.y - body.y;
      const dz = entity.z - body.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq <= threshold * threshold) {
        entity.hp = 0;
        entity.speed = 0;
        kills.push({
          type: MessageType.Kill,
          targetId: entity.id,
          attackerId: '',
          attackerName: body.type === 'sun' ? 'the Sun' : 'a planet',
          targetName: '',
          attackerTeam: -1,
          targetTeam: -1,
          x: entity.x,
          y: entity.y,
          z: entity.z,
        });
        break; // entity is dead, no need to check other bodies
      }
    }
  }
  return kills;
}

/** Update heat: decay over time, add heat on shot, trigger/clear overheat. Mutates in place. */
export function updateHeat(player: PlayerLike, dt: number, justFired: boolean): void {
  // Decay heat
  player.heat = Math.max(0, player.heat - HEAT_DECAY_RATE * dt);

  // Add heat from firing
  if (justFired) {
    player.heat = Math.min(OVERHEAT_THRESHOLD, player.heat + HEAT_PER_SHOT);
  }

  // Enter overheat
  if (player.heat >= OVERHEAT_THRESHOLD) {
    player.overheated = true;
  }

  // Exit overheat
  if (player.overheated && player.heat <= OVERHEAT_RECOVERY) {
    player.overheated = false;
  }
}
