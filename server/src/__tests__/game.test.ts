import { describe, it, expect } from 'vitest';
import {
  computeForward,
  updatePlayerMovement,
  spawnProjectile,
  moveProjectiles,
  detectCollisions,
  type PlayerLike,
  type Projectile,
} from '../game.js';

// Helper: create a default player at the origin with no input
function makePlayer(overrides: Partial<PlayerLike> = {}): PlayerLike {
  return {
    id: 'p1',
    x: 0, y: 0, z: 0,
    yaw: 0, pitch: 0, roll: 0,
    speed: 0,
    keys: {},
    mouseDx: 0, mouseDy: 0,
    fire: false,
    fireCooldown: 0,
    ...overrides,
  };
}

function makeProjectile(overrides: Partial<Projectile> = {}): Projectile {
  return {
    id: 1,
    ownerId: 'p1',
    x: 0, y: 0, z: 0,
    dx: 0, dy: 0, dz: -1,
    age: 0,
    ...overrides,
  };
}

// ---- computeForward ----

describe('computeForward', () => {
  it('yaw=0, pitch=0 → facing negative Z', () => {
    const f = computeForward(0, 0);
    expect(f.x).toBeCloseTo(0);
    expect(f.y).toBeCloseTo(0);
    expect(f.z).toBeCloseTo(-1);
  });

  it('yaw=π/2 → facing negative X', () => {
    const f = computeForward(Math.PI / 2, 0);
    expect(f.x).toBeCloseTo(-1);
    expect(f.y).toBeCloseTo(0);
    expect(f.z).toBeCloseTo(0);
  });

  it('yaw=π → facing positive Z', () => {
    const f = computeForward(Math.PI, 0);
    expect(f.x).toBeCloseTo(0);
    expect(f.y).toBeCloseTo(0);
    expect(f.z).toBeCloseTo(1);
  });

  it('pitch=π/4 → positive Y, result is unit length', () => {
    const f = computeForward(0, Math.PI / 4);
    expect(f.y).toBeGreaterThan(0);
    const len = Math.sqrt(f.x ** 2 + f.y ** 2 + f.z ** 2);
    expect(len).toBeCloseTo(1);
  });
});

// ---- updatePlayerMovement ----

describe('updatePlayerMovement', () => {
  const dt = 1 / 60;

  it('W key → speed increases, capped at MAX_SPEED', () => {
    const player = makePlayer({ keys: { w: true } });
    // Apply many ticks so it would exceed MAX_SPEED
    for (let i = 0; i < 600; i++) updatePlayerMovement(player, dt);
    expect(player.speed).toBeCloseTo(10); // MAX_SPEED
  });

  it('S key → speed decreases, never goes negative', () => {
    const player = makePlayer({ speed: 2, keys: { s: true } });
    for (let i = 0; i < 600; i++) updatePlayerMovement(player, dt);
    expect(player.speed).toBe(0);
  });

  it('no keys → speed unchanged (coasting)', () => {
    const player = makePlayer({ speed: 5 });
    updatePlayerMovement(player, dt);
    expect(player.speed).toBe(5);
  });

  it('mouse dx applied → yaw changes proportionally', () => {
    const player = makePlayer({ mouseDx: 100 });
    updatePlayerMovement(player, dt);
    // yaw -= mouseDx * MOUSE_SENSITIVITY = -100 * 0.003 = -0.3
    expect(player.yaw).toBeCloseTo(-0.3);
    // mouse deltas reset after tick
    expect(player.mouseDx).toBe(0);
  });

  it('pitch clamped at ±MAX_PITCH (π/3)', () => {
    // Large positive mouseDy → pitch would go very negative
    const player = makePlayer({ mouseDy: 10000 });
    updatePlayerMovement(player, dt);
    expect(player.pitch).toBeGreaterThanOrEqual(-Math.PI / 3);
    expect(player.pitch).toBeLessThanOrEqual(Math.PI / 3);
  });

  it('A key → roll increases; release → roll decays toward 0', () => {
    const player = makePlayer({ keys: { a: true } });
    updatePlayerMovement(player, dt);
    expect(player.roll).toBeGreaterThan(0);

    // Now release and let it decay
    const rollBefore = player.roll;
    player.keys = {};
    updatePlayerMovement(player, dt);
    expect(Math.abs(player.roll)).toBeLessThan(Math.abs(rollBefore));
  });

  it('D key → roll decreases', () => {
    const player = makePlayer({ keys: { d: true } });
    updatePlayerMovement(player, dt);
    expect(player.roll).toBeLessThan(0);
  });

  it('position moves along forward vector by speed * dt', () => {
    // yaw=0, pitch=0 → forward is (0, 0, -1)
    const player = makePlayer({ speed: 10 });
    updatePlayerMovement(player, dt);
    expect(player.x).toBeCloseTo(0);
    expect(player.y).toBeCloseTo(0);
    expect(player.z).toBeCloseTo(-10 * dt);
  });

  it('ArrowUp works like W', () => {
    const player = makePlayer({ keys: { ArrowUp: true } });
    updatePlayerMovement(player, dt);
    expect(player.speed).toBeGreaterThan(0);
  });

  it('ArrowDown works like S', () => {
    const player = makePlayer({ speed: 5, keys: { ArrowDown: true } });
    updatePlayerMovement(player, dt);
    expect(player.speed).toBeLessThan(5);
  });
});

// ---- spawnProjectile ----

describe('spawnProjectile', () => {
  it('fire=true, cooldown=0, count below max → returns Projectile', () => {
    const player = makePlayer({ fire: true, fireCooldown: 0 });
    const proj = spawnProjectile(player, 0, 42);
    expect(proj).not.toBeNull();
    expect(proj!.id).toBe(42);
    expect(proj!.ownerId).toBe('p1');
    expect(proj!.age).toBe(0);
  });

  it('cooldown > 0 → returns null', () => {
    const player = makePlayer({ fire: true, fireCooldown: 0.1 });
    expect(spawnProjectile(player, 0, 1)).toBeNull();
  });

  it('fire=false → returns null', () => {
    const player = makePlayer({ fire: false, fireCooldown: 0 });
    expect(spawnProjectile(player, 0, 1)).toBeNull();
  });

  it('count = MAX_PROJECTILES_PER_PLAYER → returns null', () => {
    const player = makePlayer({ fire: true, fireCooldown: 0 });
    expect(spawnProjectile(player, 10, 1)).toBeNull();
  });

  it('spawned projectile direction matches computeForward', () => {
    const yaw = 1.2;
    const pitch = 0.3;
    const player = makePlayer({ fire: true, yaw, pitch });
    const proj = spawnProjectile(player, 0, 1)!;
    const fwd = computeForward(yaw, pitch);
    expect(proj.dx).toBeCloseTo(fwd.x);
    expect(proj.dy).toBeCloseTo(fwd.y);
    expect(proj.dz).toBeCloseTo(fwd.z);
  });

  it('spawned projectile is offset along forward by 0.95', () => {
    const player = makePlayer({ fire: true, x: 5, y: 3, z: -2 });
    const proj = spawnProjectile(player, 0, 1)!;
    const fwd = computeForward(0, 0);
    expect(proj.x).toBeCloseTo(5 + fwd.x * 0.95);
    expect(proj.y).toBeCloseTo(3 + fwd.y * 0.95);
    expect(proj.z).toBeCloseTo(-2 + fwd.z * 0.95);
  });
});

// ---- moveProjectiles ----

describe('moveProjectiles', () => {
  const dt = 1 / 60;

  it('single projectile moves by PROJECTILE_SPEED * dt in its direction', () => {
    const p = makeProjectile({ x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: -1 });
    const result = moveProjectiles([p], dt);
    expect(result).toHaveLength(1);
    expect(result[0].z).toBeCloseTo(-40 * dt); // PROJECTILE_SPEED = 40
    expect(result[0].x).toBeCloseTo(0);
  });

  it('age increments by dt each call', () => {
    const p = makeProjectile({ age: 0 });
    const result = moveProjectiles([p], dt);
    expect(result[0].age).toBeCloseTo(dt);
  });

  it('projectile with age >= PROJECTILE_LIFETIME gets removed', () => {
    const p = makeProjectile({ age: 2.99 });
    // After this tick: age = 2.99 + 1/60 ≈ 3.007 >= 3
    const result = moveProjectiles([p], dt);
    expect(result).toHaveLength(0);
  });

  it('projectile just under lifetime survives', () => {
    // age after tick needs to be < 3
    const p = makeProjectile({ age: 2.9 });
    const result = moveProjectiles([p], dt);
    expect(result).toHaveLength(1);
  });

  it('empty input → empty output', () => {
    expect(moveProjectiles([], dt)).toHaveLength(0);
  });
});

// ---- detectCollisions ----

describe('detectCollisions', () => {
  it('projectile within HIT_RADIUS of target → hit, projectile removed', () => {
    const proj = makeProjectile({ ownerId: 'attacker', x: 0, y: 0, z: 0 });
    const target = { id: 'target', x: 0.5, y: 0, z: 0 }; // dist = 0.5 < 1
    const { survivors, hits } = detectCollisions([proj], [target]);
    expect(survivors).toHaveLength(0);
    expect(hits).toHaveLength(1);
    expect(hits[0].targetId).toBe('target');
  });

  it('projectile beyond HIT_RADIUS → miss, projectile survives', () => {
    const proj = makeProjectile({ ownerId: 'attacker', x: 0, y: 0, z: 0 });
    const target = { id: 'target', x: 5, y: 0, z: 0 }; // dist = 5 > 1
    const { survivors, hits } = detectCollisions([proj], [target]);
    expect(survivors).toHaveLength(1);
    expect(hits).toHaveLength(0);
  });

  it('projectile near owner → skipped (no self-hit)', () => {
    const proj = makeProjectile({ ownerId: 'p1', x: 0, y: 0, z: 0 });
    const owner = { id: 'p1', x: 0, y: 0, z: 0 }; // same pos, same owner
    const { survivors, hits } = detectCollisions([proj], [owner]);
    expect(survivors).toHaveLength(1);
    expect(hits).toHaveLength(0);
  });

  it('multiple projectiles, one hits → only that one removed', () => {
    const p1 = makeProjectile({ id: 1, ownerId: 'a', x: 0, y: 0, z: 0 });
    const p2 = makeProjectile({ id: 2, ownerId: 'a', x: 100, y: 100, z: 100 });
    const target = { id: 'b', x: 0.5, y: 0, z: 0 };
    const { survivors, hits } = detectCollisions([p1, p2], [target]);
    expect(hits).toHaveLength(1);
    expect(hits[0].projectileId).toBe(1);
    expect(survivors).toHaveLength(1);
    expect(survivors[0].id).toBe(2);
  });

  it('hit message has correct position', () => {
    const proj = makeProjectile({ ownerId: 'a', x: 3, y: 4, z: 5 });
    const target = { id: 'b', x: 3.1, y: 4, z: 5 };
    const { hits } = detectCollisions([proj], [target]);
    expect(hits[0].x).toBe(3);
    expect(hits[0].y).toBe(4);
    expect(hits[0].z).toBe(5);
  });

  it('projectile exactly at HIT_RADIUS distance → hit (<=)', () => {
    // HIT_RADIUS = 1, so dist = 1 should count as a hit
    const proj = makeProjectile({ ownerId: 'a', x: 0, y: 0, z: 0 });
    const target = { id: 'b', x: 1, y: 0, z: 0 };
    const { hits } = detectCollisions([proj], [target]);
    expect(hits).toHaveLength(1);
  });
});
