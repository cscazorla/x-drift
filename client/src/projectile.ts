import * as THREE from 'three';
import type { ProjectileState } from '@x-drift/shared';

const projectileCache = new Map<number, THREE.Mesh>();

const BEAM_LENGTH = 1.5;
const BEAM_RADIUS = 0.035;

// Cylinder along Y by default — we'll rotate to match direction
const sharedGeometry = new THREE.CylinderGeometry(
  BEAM_RADIUS, BEAM_RADIUS, BEAM_LENGTH, 6, 1,
);
// Shift so the cylinder's origin is at its tail (beam extends forward)
sharedGeometry.translate(0, BEAM_LENGTH / 2, 0);

const sharedMaterial = new THREE.MeshBasicMaterial({
  color: 0xffee44,
  transparent: true,
  opacity: 0.9,
});

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

export function updateProjectiles(
  scene: THREE.Scene,
  states: ProjectileState[],
): void {
  const activeIds = new Set(states.map((s) => s.id));

  // Remove stale projectiles
  for (const [id, mesh] of projectileCache) {
    if (!activeIds.has(id)) {
      scene.remove(mesh);
      projectileCache.delete(id);
    }
  }

  // Create or update active projectiles
  for (const s of states) {
    let mesh = projectileCache.get(s.id);
    if (!mesh) {
      mesh = new THREE.Mesh(sharedGeometry, sharedMaterial);
      scene.add(mesh);
      projectileCache.set(s.id, mesh);
    }
    mesh.position.set(s.x, s.y, s.z);

    // Orient beam along travel direction
    _dir.set(s.dx, s.dy, s.dz);
    mesh.quaternion.setFromUnitVectors(_up, _dir);
  }
}
