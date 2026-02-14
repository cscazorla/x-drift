import { describe, it, expect } from 'vitest';
import {
  createNPC,
  createAllNPCs,
  updateNPCAI,
  findNearestTarget,
  respawnNPC,
  type NPC,
} from '../npc.js';
import { updatePlayerMovement } from '../game.js';
import {
  MAX_HP,
  NPC_COUNT,
  NPC_MIN_SKILL,
  NPC_MAX_SKILL,
  NPC_WANDER_INTERVAL_MIN,
  NPC_WANDER_INTERVAL_MAX,
  MAX_SPEED,
  MAX_PITCH,
  NPC_TURN_RATE,
  NPC_DETECTION_RANGE,
  NPC_MIN_COMBAT_RANGE,
  NPC_AIM_THRESHOLD_MIN,
  NPC_AIM_THRESHOLD_MAX,
  NPC_MAX_SPEED_FACTOR,
} from '@x-drift/shared';

// Helper: create a test NPC with overrides
function makeNPC(overrides: Partial<NPC> = {}): NPC {
  return {
    id: 'npc-test',
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    hp: MAX_HP,
    keys: {},
    mouseDx: 0,
    mouseDy: 0,
    fire: false,
    fireCooldown: 0,
    skill: 0.5,
    targetYaw: 0,
    targetPitch: 0,
    wanderTimer: 3,
    kills: 0,
    deaths: 0,
    team: 0,
    ...overrides,
  };
}

// ---- createNPC ----

describe('createNPC', () => {
  it('returns NPC with given id, zero speed, fire=false', () => {
    const npc = createNPC('npc-42', 0);
    expect(npc.id).toBe('npc-42');
    expect(npc.speed).toBe(0);
    expect(npc.fire).toBe(false);
  });

  it('skill within [NPC_MIN_SKILL, NPC_MAX_SKILL]', () => {
    for (let i = 0; i < 20; i++) {
      const npc = createNPC(`npc-${i}`, i % 2);
      expect(npc.skill).toBeGreaterThanOrEqual(NPC_MIN_SKILL);
      expect(npc.skill).toBeLessThanOrEqual(NPC_MAX_SKILL);
    }
  });

  it('has positive wanderTimer', () => {
    const npc = createNPC('npc-1', 0);
    expect(npc.wanderTimer).toBeGreaterThan(0);
  });
});

// ---- createAllNPCs ----

describe('createAllNPCs', () => {
  it('creates NPC_COUNT NPCs with unique npc- prefixed IDs', () => {
    const npcs = createAllNPCs();
    expect(npcs).toHaveLength(NPC_COUNT);
    const ids = npcs.map((n) => n.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(NPC_COUNT);
    for (const id of ids) {
      expect(id).toMatch(/^npc-/);
    }
  });
});

// ---- updateNPCAI ----

describe('updateNPCAI', () => {
  const dt = 1 / 60;

  it('decrements wanderTimer by dt when no target', () => {
    const npc = makeNPC({ wanderTimer: 3.0 });
    updateNPCAI(npc, dt, []);
    expect(npc.wanderTimer).toBeCloseTo(3.0 - dt);
  });

  it('picks new target direction when timer expires, resets timer', () => {
    const npc = makeNPC({ wanderTimer: 0.001, targetYaw: 0, targetPitch: 0 });
    updateNPCAI(npc, 0.01, []);
    expect(npc.wanderTimer).toBeGreaterThanOrEqual(NPC_WANDER_INTERVAL_MIN);
    expect(npc.wanderTimer).toBeLessThanOrEqual(NPC_WANDER_INTERVAL_MAX);
  });

  it('sets keys.w when speed < target speed', () => {
    const npc = makeNPC({ speed: 0, skill: 0.5 });
    updateNPCAI(npc, dt, []);
    expect(npc.keys.w).toBe(true);
    expect(npc.keys.s).toBeUndefined();
  });

  it('sets keys.s when speed > target speed', () => {
    const npc = makeNPC({ speed: MAX_SPEED, skill: 0.3 });
    updateNPCAI(npc, dt, []);
    expect(npc.keys.s).toBe(true);
    expect(npc.keys.w).toBeUndefined();
  });

  it('neither key when at target speed', () => {
    const skill = 0.5;
    const targetSpeed = skill * MAX_SPEED * NPC_MAX_SPEED_FACTOR;
    const npc = makeNPC({ speed: targetSpeed, skill });
    updateNPCAI(npc, dt, []);
    expect(npc.keys.w).toBeUndefined();
    expect(npc.keys.s).toBeUndefined();
  });

  it('fire is false when no targets nearby', () => {
    const npc = makeNPC();
    npc.fire = true;
    updateNPCAI(npc, dt, []);
    expect(npc.fire).toBe(false);
  });

  it('mouseDx steers toward targetYaw (correct sign)', () => {
    const npc = makeNPC({ yaw: 0, targetYaw: 0.5, skill: 1.0 });
    updateNPCAI(npc, dt, []);
    expect(npc.mouseDx).toBeLessThan(0);
  });

  it('mouseDy steers toward targetPitch (correct sign)', () => {
    const npc = makeNPC({ pitch: 0, targetPitch: 0.3, skill: 1.0 });
    updateNPCAI(npc, dt, []);
    expect(npc.mouseDy).toBeLessThan(0);
  });

  it('mouse deltas clamped to skill-based maximum', () => {
    const npc = makeNPC({ yaw: 0, targetYaw: Math.PI, skill: 0.3 });
    updateNPCAI(npc, dt, []);
    const maxDelta = 0.3 * NPC_TURN_RATE;
    expect(Math.abs(npc.mouseDx)).toBeLessThanOrEqual(maxDelta + 0.001);
    expect(Math.abs(npc.mouseDy)).toBeLessThanOrEqual(maxDelta + 0.001);
  });
});

// ---- updateNPCAI combat ----

describe('updateNPCAI combat', () => {
  const dt = 1 / 60;

  it('aims at nearest entity', () => {
    const npc = makeNPC({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, skill: 1.0 });
    // Place target directly ahead along -z axis (yaw=0 → forward is -z)
    const entities = [
      { id: 'npc-test', x: 0, y: 0, z: 0, hp: MAX_HP, team: 0 },
      { id: 'enemy-1', x: 0, y: 0, z: -20, hp: MAX_HP, team: 1 },
      { id: 'enemy-2', x: 0, y: 0, z: -50, hp: MAX_HP, team: 1 },
    ];
    updateNPCAI(npc, dt, entities);
    // Should aim at enemy-1 (closer) → targetYaw should be ~0 (straight ahead on -z)
    expect(npc.targetYaw).toBeCloseTo(0, 1);
  });

  it('ignores self', () => {
    const npc = makeNPC({ x: 0, y: 0, z: 0 });
    const entities = [{ id: 'npc-test', x: 0, y: 0, z: 0, hp: MAX_HP, team: 0 }];
    const target = findNearestTarget(npc, entities);
    expect(target).toBeNull();
  });

  it('ignores dead entities', () => {
    const npc = makeNPC({ x: 0, y: 0, z: 0 });
    const entities = [
      { id: 'npc-test', x: 0, y: 0, z: 0, hp: MAX_HP, team: 0 },
      { id: 'dead-1', x: 10, y: 0, z: 0, hp: 0, team: 1 },
    ];
    const target = findNearestTarget(npc, entities);
    expect(target).toBeNull();
  });

  it('ignores entities too close (within min combat range)', () => {
    const npc = makeNPC({ x: 0, y: 0, z: 0 });
    const entities = [
      { id: 'npc-test', x: 0, y: 0, z: 0, hp: MAX_HP, team: 0 },
      { id: 'close-1', x: NPC_MIN_COMBAT_RANGE * 0.5, y: 0, z: 0, hp: MAX_HP, team: 1 },
    ];
    const target = findNearestTarget(npc, entities);
    expect(target).toBeNull();
  });

  it('ignores entities out of range', () => {
    const npc = makeNPC({ x: 0, y: 0, z: 0 });
    const entities = [
      { id: 'npc-test', x: 0, y: 0, z: 0, hp: MAX_HP, team: 0 },
      { id: 'far-1', x: NPC_DETECTION_RANGE + 10, y: 0, z: 0, hp: MAX_HP, team: 1 },
    ];
    const target = findNearestTarget(npc, entities);
    expect(target).toBeNull();
  });

  it('fires when aim error is below threshold', () => {
    // Place target exactly along forward direction (yaw=0 → forward is (0,0,-1))
    const npc = makeNPC({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, skill: 1.0 });
    const entities = [
      { id: 'npc-test', x: 0, y: 0, z: 0, hp: MAX_HP, team: 0 },
      { id: 'enemy', x: 0, y: 0, z: -20, hp: MAX_HP, team: 1 },
    ];
    updateNPCAI(npc, dt, entities);
    // Target is directly ahead, aim error ≈ 0 which is < threshold
    expect(npc.fire).toBe(true);
  });

  it('does not fire when aim error exceeds threshold', () => {
    // Place target far to the side — NPC facing +z but target at +x
    const npc = makeNPC({ x: 0, y: 0, z: 0, yaw: Math.PI, pitch: 0, skill: 1.0 });
    const entities = [
      { id: 'npc-test', x: 0, y: 0, z: 0, hp: MAX_HP, team: 0 },
      { id: 'enemy', x: 30, y: 0, z: 0, hp: MAX_HP, team: 1 },
    ];
    updateNPCAI(npc, dt, entities);
    // Target is 90° off to the side, aim error >> threshold
    expect(npc.fire).toBe(false);
  });

  it('low-skill NPC fires at wider angle than high-skill', () => {
    const thresholdLow =
      NPC_AIM_THRESHOLD_MAX - 0.3 * (NPC_AIM_THRESHOLD_MAX - NPC_AIM_THRESHOLD_MIN);
    const thresholdHigh =
      NPC_AIM_THRESHOLD_MAX - 1.0 * (NPC_AIM_THRESHOLD_MAX - NPC_AIM_THRESHOLD_MIN);
    expect(thresholdLow).toBeGreaterThan(thresholdHigh);
  });

  it('ignores same-team entities', () => {
    const npc = makeNPC({ x: 0, y: 0, z: 0, team: 0 });
    const entities = [
      { id: 'npc-test', x: 0, y: 0, z: 0, hp: MAX_HP, team: 0 },
      { id: 'teammate', x: 10, y: 0, z: 0, hp: MAX_HP, team: 0 },
    ];
    const target = findNearestTarget(npc, entities);
    expect(target).toBeNull();
  });

  it('targets enemy-team entity, ignores same-team', () => {
    const npc = makeNPC({ x: 0, y: 0, z: 0, team: 0 });
    const entities = [
      { id: 'npc-test', x: 0, y: 0, z: 0, hp: MAX_HP, team: 0 },
      { id: 'teammate', x: 10, y: 0, z: 0, hp: MAX_HP, team: 0 },
      { id: 'enemy', x: 15, y: 0, z: 0, hp: MAX_HP, team: 1 },
    ];
    const target = findNearestTarget(npc, entities);
    expect(target).not.toBeNull();
    expect(target!.id).toBe('enemy');
  });

  it('resets wanderTimer in combat mode', () => {
    const npc = makeNPC({ x: 0, y: 0, z: 0, wanderTimer: 5.0 });
    const entities = [
      { id: 'npc-test', x: 0, y: 0, z: 0, hp: MAX_HP, team: 0 },
      { id: 'enemy', x: 10, y: 0, z: 0, hp: MAX_HP, team: 1 },
    ];
    updateNPCAI(npc, dt, entities);
    expect(npc.wanderTimer).toBe(0);
  });
});

// ---- Integration: NPC + updatePlayerMovement ----

describe('NPC + updatePlayerMovement integration', () => {
  const dt = 1 / 60;

  it('NPC accelerates toward target speed over many ticks', () => {
    const npc = makeNPC({ speed: 0, skill: 0.5 });
    const targetSpeed = npc.skill * MAX_SPEED * NPC_MAX_SPEED_FACTOR;
    for (let i = 0; i < 300; i++) {
      updateNPCAI(npc, dt, []);
      updatePlayerMovement(npc, dt);
    }
    expect(npc.speed).toBeCloseTo(targetSpeed, 0);
  });

  it('NPC position changes over time', () => {
    const npc = makeNPC({ speed: 0, skill: 0.8 });
    const startX = npc.x;
    const startY = npc.y;
    const startZ = npc.z;
    for (let i = 0; i < 200; i++) {
      updateNPCAI(npc, dt, []);
      updatePlayerMovement(npc, dt);
    }
    const dist = Math.sqrt((npc.x - startX) ** 2 + (npc.y - startY) ** 2 + (npc.z - startZ) ** 2);
    expect(dist).toBeGreaterThan(0);
  });

  it('pitch stays within MAX_PITCH bounds after 1000 ticks', () => {
    const npc = makeNPC({ skill: 1.0 });
    for (let i = 0; i < 1000; i++) {
      updateNPCAI(npc, dt, []);
      updatePlayerMovement(npc, dt);
    }
    expect(npc.pitch).toBeGreaterThanOrEqual(-MAX_PITCH);
    expect(npc.pitch).toBeLessThanOrEqual(MAX_PITCH);
  });
});

// ---- respawnNPC ----

describe('respawnNPC', () => {
  it('resets hp to MAX_HP', () => {
    const npc = makeNPC({ hp: 0 });
    respawnNPC(npc);
    expect(npc.hp).toBe(MAX_HP);
  });

  it('resets speed to 0', () => {
    const npc = makeNPC({ speed: 5, hp: 0 });
    respawnNPC(npc);
    expect(npc.speed).toBe(0);
  });

  it('position changes (new random spawn)', () => {
    const npc = makeNPC({ x: 0, y: 0, z: 0, hp: 0 });
    respawnNPC(npc);
    const dist = Math.sqrt(npc.x ** 2 + npc.y ** 2 + npc.z ** 2);
    expect(dist).toBeGreaterThan(0);
  });

  it('keeps same id and skill', () => {
    const npc = makeNPC({ id: 'npc-42', skill: 0.7, hp: 0 });
    respawnNPC(npc);
    expect(npc.id).toBe('npc-42');
    expect(npc.skill).toBe(0.7);
  });
});
