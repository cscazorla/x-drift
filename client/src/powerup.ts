import * as THREE from 'three';
import type { PowerUpState } from '@x-drift/shared';

const powerUpCache = new Map<number, { group: THREE.Group }>();

const sharedGeometry = new THREE.OctahedronGeometry(0.8, 0);
const glowGeometry = new THREE.SphereGeometry(1.2, 16, 12);

const typeMaterials: Record<string, THREE.MeshStandardMaterial> = {
  health: new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff88,
    emissiveIntensity: 2,
  }),
  shield: new THREE.MeshStandardMaterial({
    color: 0x4488ff,
    emissive: 0x4488ff,
    emissiveIntensity: 2,
  }),
  speed: new THREE.MeshStandardMaterial({
    color: 0xffdd00,
    emissive: 0xffdd00,
    emissiveIntensity: 2,
  }),
  rapidFire: new THREE.MeshStandardMaterial({
    color: 0xff4400,
    emissive: 0xff4400,
    emissiveIntensity: 2,
  }),
};

const typeGlowMaterials: Record<string, THREE.MeshStandardMaterial> = {
  health: new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff88,
    emissiveIntensity: 1,
    transparent: true,
    opacity: 0.15,
  }),
  shield: new THREE.MeshStandardMaterial({
    color: 0x4488ff,
    emissive: 0x4488ff,
    emissiveIntensity: 1,
    transparent: true,
    opacity: 0.15,
  }),
  speed: new THREE.MeshStandardMaterial({
    color: 0xffdd00,
    emissive: 0xffdd00,
    emissiveIntensity: 1,
    transparent: true,
    opacity: 0.15,
  }),
  rapidFire: new THREE.MeshStandardMaterial({
    color: 0xff4400,
    emissive: 0xff4400,
    emissiveIntensity: 1,
    transparent: true,
    opacity: 0.15,
  }),
};

function createPowerUpGroup(type: string): THREE.Group {
  const group = new THREE.Group();

  const core = new THREE.Mesh(sharedGeometry, typeMaterials[type]);
  group.add(core);

  const glow = new THREE.Mesh(glowGeometry, typeGlowMaterials[type]);
  group.add(glow);

  return group;
}

export function updatePowerUps(scene: THREE.Scene, states: PowerUpState[]): void {
  const activeIds = new Set(states.map((s) => s.id));

  // Remove stale
  for (const [id, entry] of powerUpCache) {
    if (!activeIds.has(id)) {
      scene.remove(entry.group);
      powerUpCache.delete(id);
    }
  }

  const now = Date.now();

  // Create or update
  for (const s of states) {
    let entry = powerUpCache.get(s.id);
    if (!entry) {
      const group = createPowerUpGroup(s.type);
      scene.add(group);
      entry = { group };
      powerUpCache.set(s.id, entry);
    }

    entry.group.position.set(s.x, s.y + Math.sin(now * 0.002) * 0.3, s.z);
    entry.group.rotation.y = now * 0.0015;
  }
}
