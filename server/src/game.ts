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
  FIRE_COOLDOWN,
  PROJECTILE_HIT_RADIUS,
  MAX_PROJECTILES_PER_PLAYER,
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
  const rollingLeft = player.keys['a'] || player.keys['ArrowLeft'];
  const rollingRight = player.keys['d'] || player.keys['ArrowRight'];
  if (rollingLeft) player.roll += ROLL_SPEED * dt;
  else if (rollingRight) player.roll -= ROLL_SPEED * dt;
  else player.roll *= Math.pow(0.05, dt); // lerp toward 0

  // 3. Compute forward vector
  const fwd = computeForward(player.yaw, player.pitch);

  // 4. Update speed
  if (player.keys['w'] || player.keys['ArrowUp']) {
    player.speed = Math.min(player.speed + ACCELERATION * dt, MAX_SPEED);
  } else if (player.keys['s'] || player.keys['ArrowDown']) {
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
  if (!player.fire || player.fireCooldown > 0 || projectileCount >= MAX_PROJECTILES_PER_PLAYER) {
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
  const lookup = entities instanceof Map
    ? entities
    : new Map(Array.from(entities as PlayerLike[], (e) => [e.id, e]));

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
        x: target.x,
        y: target.y,
        z: target.z,
      });
    }
  }
  return kills;
}
