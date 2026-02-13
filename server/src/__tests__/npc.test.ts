import { describe, it, expect } from 'vitest';
import { createNPC, createAllNPCs, updateNPCAI, type NPC } from '../npc.js';
import { updatePlayerMovement } from '../game.js';
import {
  NPC_COUNT,
  NPC_MIN_SKILL,
  NPC_MAX_SKILL,
  NPC_WANDER_INTERVAL_MIN,
  NPC_WANDER_INTERVAL_MAX,
  MAX_SPEED,
  MAX_PITCH,
  MOUSE_SENSITIVITY,
  NPC_TURN_RATE,
} from '@x-drift/shared';

// Helper: create a test NPC with overrides
function makeNPC(overrides: Partial<NPC> = {}): NPC {
  return {
    id: 'npc-test',
    x: 0, y: 0, z: 0,
    yaw: 0, pitch: 0, roll: 0,
    speed: 0,
    keys: {},
    mouseDx: 0, mouseDy: 0,
    fire: false,
    fireCooldown: 0,
    skill: 0.5,
    targetYaw: 0,
    targetPitch: 0,
    wanderTimer: 3,
    ...overrides,
  };
}

// ---- createNPC ----

describe('createNPC', () => {
  it('returns NPC with given id, zero speed, fire=false', () => {
    const npc = createNPC('npc-42');
    expect(npc.id).toBe('npc-42');
    expect(npc.speed).toBe(0);
    expect(npc.fire).toBe(false);
  });

  it('skill within [NPC_MIN_SKILL, NPC_MAX_SKILL]', () => {
    for (let i = 0; i < 20; i++) {
      const npc = createNPC(`npc-${i}`);
      expect(npc.skill).toBeGreaterThanOrEqual(NPC_MIN_SKILL);
      expect(npc.skill).toBeLessThanOrEqual(NPC_MAX_SKILL);
    }
  });

  it('has positive wanderTimer', () => {
    const npc = createNPC('npc-1');
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

  it('decrements wanderTimer by dt', () => {
    const npc = makeNPC({ wanderTimer: 3.0 });
    updateNPCAI(npc, dt);
    expect(npc.wanderTimer).toBeCloseTo(3.0 - dt);
  });

  it('picks new target direction when timer expires, resets timer', () => {
    const npc = makeNPC({ wanderTimer: 0.001, targetYaw: 0, targetPitch: 0 });
    // Run with dt large enough to expire the timer
    updateNPCAI(npc, 0.01);
    // Timer should be reset to a value within the wander interval range
    expect(npc.wanderTimer).toBeGreaterThanOrEqual(NPC_WANDER_INTERVAL_MIN);
    expect(npc.wanderTimer).toBeLessThanOrEqual(NPC_WANDER_INTERVAL_MAX);
  });

  it('sets keys.w when speed < target speed', () => {
    const npc = makeNPC({ speed: 0, skill: 0.5 });
    // target speed = 0.5 * MAX_SPEED = 5, current speed = 0
    updateNPCAI(npc, dt);
    expect(npc.keys['w']).toBe(true);
    expect(npc.keys['s']).toBeUndefined();
  });

  it('sets keys.s when speed > target speed', () => {
    const npc = makeNPC({ speed: MAX_SPEED, skill: 0.3 });
    // target speed = 0.3 * 10 = 3, current speed = 10
    updateNPCAI(npc, dt);
    expect(npc.keys['s']).toBe(true);
    expect(npc.keys['w']).toBeUndefined();
  });

  it('neither key when at target speed', () => {
    const skill = 0.5;
    const targetSpeed = skill * MAX_SPEED;
    const npc = makeNPC({ speed: targetSpeed, skill });
    updateNPCAI(npc, dt);
    expect(npc.keys['w']).toBeUndefined();
    expect(npc.keys['s']).toBeUndefined();
  });

  it('fire is always false', () => {
    const npc = makeNPC();
    npc.fire = true; // force to true
    updateNPCAI(npc, dt);
    expect(npc.fire).toBe(false);
  });

  it('mouseDx steers toward targetYaw (correct sign)', () => {
    // Target is to the left (positive yaw error) → negative mouseDx
    const npc = makeNPC({ yaw: 0, targetYaw: 0.5, skill: 1.0 });
    updateNPCAI(npc, dt);
    // yawError = 0.5, rawDx = -0.5/0.003 ≈ -166.7 → negative
    expect(npc.mouseDx).toBeLessThan(0);
  });

  it('mouseDy steers toward targetPitch (correct sign)', () => {
    // Target pitch above current → positive pitch error → negative mouseDy
    const npc = makeNPC({ pitch: 0, targetPitch: 0.3, skill: 1.0 });
    updateNPCAI(npc, dt);
    // pitchError = 0.3, rawDy = -0.3/0.003 = -100 → negative
    expect(npc.mouseDy).toBeLessThan(0);
  });

  it('mouse deltas clamped to skill-based maximum', () => {
    // Large yaw error with low skill → should be clamped
    const npc = makeNPC({ yaw: 0, targetYaw: Math.PI, skill: 0.3 });
    updateNPCAI(npc, dt);
    const maxDelta = 0.3 * NPC_TURN_RATE;
    expect(Math.abs(npc.mouseDx)).toBeLessThanOrEqual(maxDelta + 0.001);
    expect(Math.abs(npc.mouseDy)).toBeLessThanOrEqual(maxDelta + 0.001);
  });
});

// ---- Integration: NPC + updatePlayerMovement ----

describe('NPC + updatePlayerMovement integration', () => {
  const dt = 1 / 60;

  it('NPC accelerates toward target speed over many ticks', () => {
    const npc = makeNPC({ speed: 0, skill: 0.5 });
    const targetSpeed = npc.skill * MAX_SPEED;
    for (let i = 0; i < 300; i++) {
      updateNPCAI(npc, dt);
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
      updateNPCAI(npc, dt);
      updatePlayerMovement(npc, dt);
    }
    const dist = Math.sqrt(
      (npc.x - startX) ** 2 + (npc.y - startY) ** 2 + (npc.z - startZ) ** 2,
    );
    expect(dist).toBeGreaterThan(0);
  });

  it('pitch stays within MAX_PITCH bounds after 1000 ticks', () => {
    const npc = makeNPC({ skill: 1.0 });
    for (let i = 0; i < 1000; i++) {
      updateNPCAI(npc, dt);
      updatePlayerMovement(npc, dt);
    }
    expect(npc.pitch).toBeGreaterThanOrEqual(-MAX_PITCH);
    expect(npc.pitch).toBeLessThanOrEqual(MAX_PITCH);
  });
});
