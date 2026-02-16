import { describe, it, expect } from 'vitest';
import {
  MAX_HP,
  POWERUP_PICKUP_RADIUS,
  POWERUP_RESPAWN_COOLDOWN,
  POWERUP_SHIELD_DURATION,
  POWERUP_SPEED_DURATION,
  POWERUP_RAPID_FIRE_DURATION,
  POWERUP_SPAWN_RADIUS_MIN,
  POWERUP_SPAWN_RADIUS_MAX,
  POWERUP_SPAWN_Y_RANGE,
} from '@x-drift/shared';
import {
  createPowerUpSlots,
  detectPowerUpPickups,
  applyPowerUpEffect,
  tickEffects,
  updatePowerUpCooldowns,
  hasEffect,
  randomPowerUpType,
  randomPowerUpPosition,
  type PowerUpSlot,
  type EffectHolder,
} from '../powerup.js';

function makeEntity(overrides: Partial<EffectHolder> = {}): EffectHolder {
  return {
    id: 'e1',
    x: 0,
    y: 0,
    z: 0,
    hp: MAX_HP,
    effects: [],
    ...overrides,
  };
}

function makeSlot(overrides: Partial<PowerUpSlot> = {}): PowerUpSlot {
  return {
    id: 1,
    type: 'health',
    x: 0,
    y: 0,
    z: 0,
    cooldown: 0,
    ...overrides,
  };
}

// ---- createPowerUpSlots ----

describe('createPowerUpSlots', () => {
  it('creates correct number of slots', () => {
    const slots = createPowerUpSlots(5, 1);
    expect(slots).toHaveLength(5);
  });

  it('assigns sequential IDs starting from startId', () => {
    const slots = createPowerUpSlots(3, 10);
    expect(slots[0].id).toBe(10);
    expect(slots[1].id).toBe(11);
    expect(slots[2].id).toBe(12);
  });

  it('all slots have valid types', () => {
    const validTypes = ['health', 'shield', 'speed', 'rapidFire'];
    const slots = createPowerUpSlots(20, 1);
    for (const slot of slots) {
      expect(validTypes).toContain(slot.type);
    }
  });

  it('all slots start with cooldown=0', () => {
    const slots = createPowerUpSlots(5, 1);
    for (const slot of slots) {
      expect(slot.cooldown).toBe(0);
    }
  });
});

// ---- randomPowerUpType ----

describe('randomPowerUpType', () => {
  it('returns a valid type', () => {
    const validTypes = ['health', 'shield', 'speed', 'rapidFire'];
    for (let i = 0; i < 50; i++) {
      expect(validTypes).toContain(randomPowerUpType());
    }
  });
});

// ---- randomPowerUpPosition ----

describe('randomPowerUpPosition', () => {
  it('returns position within spawn bounds', () => {
    for (let i = 0; i < 50; i++) {
      const pos = randomPowerUpPosition();
      const horizDist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
      expect(horizDist).toBeGreaterThanOrEqual(POWERUP_SPAWN_RADIUS_MIN - 0.01);
      expect(horizDist).toBeLessThanOrEqual(POWERUP_SPAWN_RADIUS_MAX + 0.01);
      expect(pos.y).toBeGreaterThanOrEqual(-POWERUP_SPAWN_Y_RANGE - 0.01);
      expect(pos.y).toBeLessThanOrEqual(POWERUP_SPAWN_Y_RANGE + 0.01);
    }
  });
});

// ---- detectPowerUpPickups ----

describe('detectPowerUpPickups', () => {
  it('picks up when entity is within pickup radius', () => {
    const slot = makeSlot({ x: 0, y: 0, z: 0 });
    const entity = makeEntity({ x: 1, y: 0, z: 0 }); // dist = 1 < POWERUP_PICKUP_RADIUS(3)
    const pickups = detectPowerUpPickups([slot], [entity]);
    expect(pickups).toHaveLength(1);
    expect(pickups[0].entityId).toBe('e1');
    expect(pickups[0].type).toBe('health');
  });

  it('no pickup when entity is outside radius', () => {
    const slot = makeSlot({ x: 0, y: 0, z: 0 });
    const entity = makeEntity({ x: 100, y: 0, z: 0 }); // dist = 100 > 3
    const pickups = detectPowerUpPickups([slot], [entity]);
    expect(pickups).toHaveLength(0);
  });

  it('dead entities are ignored', () => {
    const slot = makeSlot({ x: 0, y: 0, z: 0 });
    const entity = makeEntity({ x: 0, y: 0, z: 0, hp: 0 });
    const pickups = detectPowerUpPickups([slot], [entity]);
    expect(pickups).toHaveLength(0);
  });

  it('sets cooldown on picked-up slot', () => {
    const slot = makeSlot({ x: 0, y: 0, z: 0 });
    const entity = makeEntity({ x: 0, y: 0, z: 0 });
    detectPowerUpPickups([slot], [entity]);
    expect(slot.cooldown).toBe(POWERUP_RESPAWN_COOLDOWN);
  });

  it('only one pickup per slot per tick', () => {
    const slot = makeSlot({ x: 0, y: 0, z: 0 });
    const e1 = makeEntity({ id: 'e1', x: 0, y: 0, z: 0 });
    const e2 = makeEntity({ id: 'e2', x: 0, y: 0, z: 1 });
    const pickups = detectPowerUpPickups([slot], [e1, e2]);
    expect(pickups).toHaveLength(1);
    expect(pickups[0].entityId).toBe('e1');
  });

  it('skips slots in cooldown', () => {
    const slot = makeSlot({ x: 0, y: 0, z: 0, cooldown: 10 });
    const entity = makeEntity({ x: 0, y: 0, z: 0 });
    const pickups = detectPowerUpPickups([slot], [entity]);
    expect(pickups).toHaveLength(0);
  });

  it('entity at exactly pickup radius boundary picks up (<=)', () => {
    const slot = makeSlot({ x: 0, y: 0, z: 0 });
    const entity = makeEntity({ x: POWERUP_PICKUP_RADIUS, y: 0, z: 0 });
    const pickups = detectPowerUpPickups([slot], [entity]);
    expect(pickups).toHaveLength(1);
  });
});

// ---- applyPowerUpEffect ----

describe('applyPowerUpEffect', () => {
  it('health heals +1 HP', () => {
    const entity = makeEntity({ hp: 2 });
    applyPowerUpEffect(entity, 'health');
    expect(entity.hp).toBe(3);
  });

  it('health caps at MAX_HP', () => {
    const entity = makeEntity({ hp: MAX_HP });
    applyPowerUpEffect(entity, 'health');
    expect(entity.hp).toBe(MAX_HP);
  });

  it('shield adds effect with correct duration', () => {
    const entity = makeEntity();
    applyPowerUpEffect(entity, 'shield');
    expect(entity.effects).toHaveLength(1);
    expect(entity.effects[0].type).toBe('shield');
    expect(entity.effects[0].remainingTime).toBe(POWERUP_SHIELD_DURATION);
  });

  it('speed adds effect with correct duration', () => {
    const entity = makeEntity();
    applyPowerUpEffect(entity, 'speed');
    expect(entity.effects).toHaveLength(1);
    expect(entity.effects[0].type).toBe('speed');
    expect(entity.effects[0].remainingTime).toBe(POWERUP_SPEED_DURATION);
  });

  it('rapidFire adds effect with correct duration', () => {
    const entity = makeEntity();
    applyPowerUpEffect(entity, 'rapidFire');
    expect(entity.effects).toHaveLength(1);
    expect(entity.effects[0].type).toBe('rapidFire');
    expect(entity.effects[0].remainingTime).toBe(POWERUP_RAPID_FIRE_DURATION);
  });

  it('same-type effect replaces (timer resets)', () => {
    const entity = makeEntity();
    applyPowerUpEffect(entity, 'shield');
    entity.effects[0].remainingTime = 3; // simulate time passing
    applyPowerUpEffect(entity, 'shield');
    expect(entity.effects).toHaveLength(1);
    expect(entity.effects[0].remainingTime).toBe(POWERUP_SHIELD_DURATION);
  });

  it('different types stack', () => {
    const entity = makeEntity();
    applyPowerUpEffect(entity, 'shield');
    applyPowerUpEffect(entity, 'speed');
    applyPowerUpEffect(entity, 'rapidFire');
    expect(entity.effects).toHaveLength(3);
  });
});

// ---- tickEffects ----

describe('tickEffects', () => {
  it('decrements remaining time', () => {
    const entity = makeEntity({ effects: [{ type: 'shield', remainingTime: 5 }] });
    tickEffects(entity, 1);
    expect(entity.effects[0].remainingTime).toBeCloseTo(4);
  });

  it('removes expired effects', () => {
    const entity = makeEntity({ effects: [{ type: 'shield', remainingTime: 0.5 }] });
    tickEffects(entity, 1);
    expect(entity.effects).toHaveLength(0);
  });

  it('keeps active effects', () => {
    const entity = makeEntity({
      effects: [
        { type: 'shield', remainingTime: 10 },
        { type: 'speed', remainingTime: 0.1 },
      ],
    });
    tickEffects(entity, 1);
    expect(entity.effects).toHaveLength(1);
    expect(entity.effects[0].type).toBe('shield');
  });
});

// ---- hasEffect ----

describe('hasEffect', () => {
  it('returns true when effect exists', () => {
    const entity = makeEntity({ effects: [{ type: 'shield', remainingTime: 5 }] });
    expect(hasEffect(entity, 'shield')).toBe(true);
  });

  it('returns false when effect does not exist', () => {
    const entity = makeEntity();
    expect(hasEffect(entity, 'shield')).toBe(false);
  });

  it('returns false for different type', () => {
    const entity = makeEntity({ effects: [{ type: 'speed', remainingTime: 5 }] });
    expect(hasEffect(entity, 'shield')).toBe(false);
  });
});

// ---- updatePowerUpCooldowns ----

describe('updatePowerUpCooldowns', () => {
  it('decrements cooldown', () => {
    const slot = makeSlot({ cooldown: 10 });
    updatePowerUpCooldowns([slot], 1);
    expect(slot.cooldown).toBeCloseTo(9);
  });

  it('respawns slot when cooldown reaches 0', () => {
    const slot = makeSlot({ cooldown: 0.5, x: 0, y: 0, z: 0, type: 'health' });
    updatePowerUpCooldowns([slot], 1);
    expect(slot.cooldown).toBe(0);
    // Verify position is within spawn bounds
    const horizDist = Math.sqrt(slot.x * slot.x + slot.z * slot.z);
    expect(horizDist).toBeGreaterThanOrEqual(POWERUP_SPAWN_RADIUS_MIN - 0.01);
    expect(horizDist).toBeLessThanOrEqual(POWERUP_SPAWN_RADIUS_MAX + 0.01);
  });

  it('does not modify active slots (cooldown=0)', () => {
    const slot = makeSlot({ cooldown: 0, x: 5, y: 5, z: 5 });
    updatePowerUpCooldowns([slot], 1);
    expect(slot.x).toBe(5);
    expect(slot.y).toBe(5);
    expect(slot.z).toBe(5);
  });
});
