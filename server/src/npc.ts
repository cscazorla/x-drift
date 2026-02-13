import {
  MAX_SPEED,
  MOUSE_SENSITIVITY,
  NPC_COUNT,
  NPC_TURN_RATE,
  NPC_WANDER_INTERVAL_MIN,
  NPC_WANDER_INTERVAL_MAX,
  NPC_MIN_SKILL,
  NPC_MAX_SKILL,
} from '@x-drift/shared';
import { type PlayerLike } from './game.js';

// ---- Types ----

export interface NPC extends PlayerLike {
  skill: number;        // 0.3–1.0, affects speed and turn rate
  targetYaw: number;    // direction the NPC is steering toward
  targetPitch: number;
  wanderTimer: number;  // countdown to next direction change
}

// ---- Factory functions ----

export function createNPC(id: string): NPC {
  const spawnAngle = Math.random() * 2 * Math.PI;
  const spawnRadius = 30 + Math.random() * 50;
  const skill = NPC_MIN_SKILL + Math.random() * (NPC_MAX_SKILL - NPC_MIN_SKILL);

  return {
    id,
    x: Math.cos(spawnAngle) * spawnRadius,
    y: (Math.random() - 0.5) * 40,
    z: Math.sin(spawnAngle) * spawnRadius,
    yaw: Math.random() * 2 * Math.PI,
    pitch: 0,
    roll: 0,
    speed: 0,
    keys: {},
    mouseDx: 0,
    mouseDy: 0,
    fire: false,
    fireCooldown: 0,
    skill,
    targetYaw: Math.random() * 2 * Math.PI,
    targetPitch: (Math.random() - 0.5) * 0.5,
    wanderTimer: NPC_WANDER_INTERVAL_MIN + Math.random() * (NPC_WANDER_INTERVAL_MAX - NPC_WANDER_INTERVAL_MIN),
  };
}

export function createAllNPCs(): NPC[] {
  const npcs: NPC[] = [];
  for (let i = 1; i <= NPC_COUNT; i++) {
    npcs.push(createNPC(`npc-${i}`));
  }
  return npcs;
}

// ---- AI logic ----

/** Normalize angle to [-π, π] */
function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Update NPC AI: sets mouseDx/mouseDy/keys so that the existing
 * updatePlayerMovement() produces the desired behavior.
 */
export function updateNPCAI(npc: NPC, dt: number): void {
  // Decrement wander timer
  npc.wanderTimer -= dt;
  if (npc.wanderTimer <= 0) {
    // Pick a new target near the current heading (max ±60° yaw, ±15° pitch)
    npc.targetYaw = npc.yaw + (Math.random() - 0.5) * (Math.PI / 1.5);
    npc.targetPitch = npc.pitch + (Math.random() - 0.5) * (Math.PI / 6);
    npc.targetPitch = Math.max(-0.4, Math.min(0.4, npc.targetPitch));
    npc.wanderTimer = NPC_WANDER_INTERVAL_MIN + Math.random() * (NPC_WANDER_INTERVAL_MAX - NPC_WANDER_INTERVAL_MIN);
  }

  // Steering: compute angular error to target
  const yawError = normalizeAngle(npc.targetYaw - npc.yaw);
  const pitchError = npc.targetPitch - npc.pitch;

  // Convert error to mouseDx/mouseDy via proportional control.
  // updatePlayerMovement does: yaw -= mouseDx * SENSITIVITY
  // So positive yaw error (target to the left) → negative mouseDx
  // Scale factor (0–1) based on error magnitude — gentle for small errors
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
  const targetSpeed = npc.skill * MAX_SPEED;
  const deadband = 0.1;
  if (npc.speed < targetSpeed - deadband) {
    npc.keys = { w: true };
  } else if (npc.speed > targetSpeed + deadband) {
    npc.keys = { s: true };
  } else {
    npc.keys = {};
  }

  // NPCs don't shoot (for now)
  npc.fire = false;
}
