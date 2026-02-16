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
  distanceSq,
  type ActiveEffect,
} from '@x-drift/shared';

// ---- Types ----

export type PowerUpType = 'health' | 'shield' | 'speed' | 'rapidFire';

export interface PowerUpSlot {
  id: number;
  type: PowerUpType;
  x: number;
  y: number;
  z: number;
  cooldown: number; // 0 = active/visible, >0 = respawning
}

export interface PickupEvent {
  slotId: number;
  entityId: string;
  type: PowerUpType;
  x: number;
  y: number;
  z: number;
}

export interface EffectHolder {
  id: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  effects: ActiveEffect[];
}

// ---- Pure functions ----

const POWERUP_TYPES: PowerUpType[] = ['health', 'shield', 'speed', 'rapidFire'];

export function randomPowerUpType(): PowerUpType {
  return POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
}

export function randomPowerUpPosition(): { x: number; y: number; z: number } {
  const angle = Math.random() * 2 * Math.PI;
  const radius =
    POWERUP_SPAWN_RADIUS_MIN +
    Math.random() * (POWERUP_SPAWN_RADIUS_MAX - POWERUP_SPAWN_RADIUS_MIN);
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const y = (Math.random() - 0.5) * 2 * POWERUP_SPAWN_Y_RANGE;
  return { x, y, z };
}

export function createPowerUpSlots(count: number, startId: number): PowerUpSlot[] {
  const slots: PowerUpSlot[] = [];
  for (let i = 0; i < count; i++) {
    const pos = randomPowerUpPosition();
    slots.push({
      id: startId + i,
      type: randomPowerUpType(),
      x: pos.x,
      y: pos.y,
      z: pos.z,
      cooldown: 0,
    });
  }
  return slots;
}

export function detectPowerUpPickups(
  slots: PowerUpSlot[],
  aliveEntities: EffectHolder[],
): PickupEvent[] {
  const pickups: PickupEvent[] = [];
  const pickupRadiusSq = POWERUP_PICKUP_RADIUS * POWERUP_PICKUP_RADIUS;

  for (const slot of slots) {
    if (slot.cooldown > 0) continue; // not active

    for (const entity of aliveEntities) {
      if (entity.hp <= 0) continue;
      const dSq = distanceSq(slot, entity);
      if (dSq <= pickupRadiusSq) {
        pickups.push({
          slotId: slot.id,
          entityId: entity.id,
          type: slot.type,
          x: slot.x,
          y: slot.y,
          z: slot.z,
        });
        slot.cooldown = POWERUP_RESPAWN_COOLDOWN;
        break; // one pickup per slot per tick
      }
    }
  }
  return pickups;
}

export function applyPowerUpEffect(entity: EffectHolder, type: PowerUpType): void {
  if (type === 'health') {
    entity.hp = Math.min(MAX_HP, entity.hp + 1);
    return;
  }

  const duration =
    type === 'shield'
      ? POWERUP_SHIELD_DURATION
      : type === 'speed'
        ? POWERUP_SPEED_DURATION
        : POWERUP_RAPID_FIRE_DURATION;

  // Replace existing same-type effect (timer reset, no stacking)
  const existing = entity.effects.findIndex((e) => e.type === type);
  if (existing >= 0) {
    entity.effects[existing].remainingTime = duration;
  } else {
    entity.effects.push({ type, remainingTime: duration });
  }
}

export function tickEffects(entity: EffectHolder, dt: number): void {
  for (let i = entity.effects.length - 1; i >= 0; i--) {
    entity.effects[i].remainingTime -= dt;
    if (entity.effects[i].remainingTime <= 0) {
      entity.effects.splice(i, 1);
    }
  }
}

export function updatePowerUpCooldowns(slots: PowerUpSlot[], dt: number): void {
  for (const slot of slots) {
    if (slot.cooldown <= 0) continue;
    slot.cooldown -= dt;
    if (slot.cooldown <= 0) {
      // Respawn at new random position with new random type
      const pos = randomPowerUpPosition();
      slot.x = pos.x;
      slot.y = pos.y;
      slot.z = pos.z;
      slot.type = randomPowerUpType();
      slot.cooldown = 0;
    }
  }
}

export function hasEffect(entity: EffectHolder, type: ActiveEffect['type']): boolean {
  return entity.effects.some((e) => e.type === type);
}
