import {
  MAX_HP,
  MAX_SPEED,
  MOUSE_SENSITIVITY,
  NPC_COUNT,
  NPC_TURN_RATE,
  NPC_WANDER_INTERVAL_MIN,
  NPC_WANDER_INTERVAL_MAX,
  NPC_MIN_SKILL,
  NPC_MAX_SKILL,
  NPC_DETECTION_RANGE,
  NPC_MIN_COMBAT_RANGE,
  NPC_AIM_THRESHOLD_MIN,
  NPC_AIM_THRESHOLD_MAX,
  NPC_MAX_SPEED_FACTOR,
  normalizeAngle,
  distanceSq,
} from '@x-drift/shared';
import { type PlayerLike } from './game.js';
import { randomSpawnPosition } from './spawn.js';

// ---- Types ----

export interface NPC extends PlayerLike {
  skill: number; // 0.3–1.0, affects speed and turn rate
  targetYaw: number; // direction the NPC is steering toward
  targetPitch: number;
  wanderTimer: number; // countdown to next direction change
  kills: number;
  deaths: number;
  team: number; // 0 = green, 1 = red
}

// ---- Factory functions ----

export function createNPC(id: string, team: number): NPC {
  const spawn = randomSpawnPosition();
  const skill = NPC_MIN_SKILL + Math.random() * (NPC_MAX_SKILL - NPC_MIN_SKILL);

  return {
    id,
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    yaw: spawn.yaw,
    pitch: 0,
    roll: 0,
    speed: 0,
    hp: MAX_HP,
    keys: {},
    mouseDx: 0,
    mouseDy: 0,
    fire: false,
    fireCooldown: 0,
    heat: 0,
    overheated: false,
    effects: [],
    skill,
    targetYaw: spawn.yaw,
    targetPitch: (Math.random() - 0.5) * 0.5,
    wanderTimer:
      NPC_WANDER_INTERVAL_MIN + Math.random() * (NPC_WANDER_INTERVAL_MAX - NPC_WANDER_INTERVAL_MIN),
    kills: 0,
    deaths: 0,
    team,
  };
}

export function createAllNPCs(): NPC[] {
  const npcs: NPC[] = [];
  for (let i = 1; i <= NPC_COUNT; i++) {
    npcs.push(createNPC(`npc-${i}`, i % 2)); // alternating teams
  }
  return npcs;
}

/** Reset an NPC to a fresh spawn state (new position, full hp). Keeps id and skill. */
export function respawnNPC(npc: NPC): void {
  const spawn = randomSpawnPosition();
  npc.x = spawn.x;
  npc.y = spawn.y;
  npc.z = spawn.z;
  npc.hp = MAX_HP;
  npc.speed = 0;
  npc.yaw = spawn.yaw;
  npc.pitch = 0;
  npc.roll = 0;
  npc.targetYaw = spawn.yaw;
  npc.targetPitch = (Math.random() - 0.5) * 0.5;
  npc.heat = 0;
  npc.overheated = false;
  npc.effects = [];
  npc.wanderTimer =
    NPC_WANDER_INTERVAL_MIN + Math.random() * (NPC_WANDER_INTERVAL_MAX - NPC_WANDER_INTERVAL_MIN);
}

// ---- AI logic ----

/** Find the nearest alive enemy entity within NPC_DETECTION_RANGE, excluding self and teammates. */
export function findNearestTarget(
  npc: NPC,
  allEntities: readonly {
    id: string;
    x: number;
    y: number;
    z: number;
    hp: number;
    team: number;
  }[],
): { id: string; x: number; y: number; z: number } | null {
  const rangeSq = NPC_DETECTION_RANGE * NPC_DETECTION_RANGE;
  const minRangeSq = NPC_MIN_COMBAT_RANGE * NPC_MIN_COMBAT_RANGE;
  let best: { id: string; x: number; y: number; z: number } | null = null;
  let bestDistSq = Infinity;

  for (const e of allEntities) {
    if (e.id === npc.id || e.hp <= 0 || e.team === npc.team) continue;
    const dSq = distanceSq(e, npc);
    if (dSq < bestDistSq && dSq >= minRangeSq && dSq <= rangeSq) {
      bestDistSq = dSq;
      best = { id: e.id, x: e.x, y: e.y, z: e.z };
    }
  }
  return best;
}

/**
 * Update NPC AI: sets mouseDx/mouseDy/keys so that the existing
 * updatePlayerMovement() produces the desired behavior.
 */
export function updateNPCAI(
  npc: NPC,
  dt: number,
  allEntities: readonly {
    id: string;
    x: number;
    y: number;
    z: number;
    hp: number;
    team: number;
  }[],
): void {
  const target = findNearestTarget(npc, allEntities);

  if (target) {
    // Combat mode: aim at target
    const dx = target.x - npc.x;
    const dy = target.y - npc.y;
    const dz = target.z - npc.z;
    const horizDist = Math.sqrt(dx * dx + dz * dz);

    // Match computeForward convention: forward = (-sin(yaw), sin(pitch), -cos(yaw))
    npc.targetYaw = Math.atan2(-dx, -dz);
    npc.targetPitch = Math.atan2(dy, horizDist);
    npc.wanderTimer = 0;

    // Fire when aim error is below skill-based threshold
    const yawError = Math.abs(normalizeAngle(npc.targetYaw - npc.yaw));
    const pitchError = Math.abs(npc.targetPitch - npc.pitch);
    const aimError = Math.sqrt(yawError * yawError + pitchError * pitchError);
    const threshold =
      NPC_AIM_THRESHOLD_MAX - npc.skill * (NPC_AIM_THRESHOLD_MAX - NPC_AIM_THRESHOLD_MIN);
    npc.fire = aimError < threshold;
  } else {
    // Wander mode
    npc.wanderTimer -= dt;
    if (npc.wanderTimer <= 0) {
      npc.targetYaw = npc.yaw + (Math.random() - 0.5) * (Math.PI / 1.5);
      npc.targetPitch = npc.pitch + (Math.random() - 0.5) * (Math.PI / 6);
      npc.targetPitch = Math.max(-0.4, Math.min(0.4, npc.targetPitch));
      npc.wanderTimer =
        NPC_WANDER_INTERVAL_MIN +
        Math.random() * (NPC_WANDER_INTERVAL_MAX - NPC_WANDER_INTERVAL_MIN);
    }
    npc.fire = false;
  }

  // Steering: compute angular error to target (shared for both modes)
  const yawError = normalizeAngle(npc.targetYaw - npc.yaw);
  const pitchError = npc.targetPitch - npc.pitch;

  const maxDelta = npc.skill * NPC_TURN_RATE;
  const yawScale = Math.min(1, Math.abs(yawError) / 0.5);
  const pitchScale = Math.min(1, Math.abs(pitchError) / 0.3);
  const rawDx = -yawError / MOUSE_SENSITIVITY;
  const rawDy = -pitchError / MOUSE_SENSITIVITY;
  const clampedDx = Math.max(-maxDelta, Math.min(maxDelta, rawDx));
  const clampedDy = Math.max(-maxDelta, Math.min(maxDelta, rawDy));
  npc.mouseDx = clampedDx * yawScale;
  npc.mouseDy = clampedDy * pitchScale;

  // Speed control: target speed based on skill
  const targetSpeed = npc.skill * MAX_SPEED * NPC_MAX_SPEED_FACTOR;
  const deadband = 0.1;
  if (npc.speed < targetSpeed - deadband) {
    npc.keys = { w: true };
  } else if (npc.speed > targetSpeed + deadband) {
    npc.keys = { s: true };
  } else {
    npc.keys = {};
  }
}
