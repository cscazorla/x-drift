import * as THREE from 'three';
import { getShip } from './ship';

const FLASH_DURATION = 0.15; // seconds

interface FlashEntry {
  shipId: string;
  timer: number;
  originals: Map<THREE.Mesh, THREE.Material>;
}

const activeFlashes: FlashEntry[] = [];

export function triggerHitFlash(shipId: string): void {
  // Anti-stacking: ignore if already flashing
  if (activeFlashes.some((f) => f.shipId === shipId)) return;

  const ship = getShip(shipId);
  if (!ship) return;

  const originals = new Map<THREE.Mesh, THREE.Material>();
  ship.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const orig = child.material as THREE.MeshStandardMaterial;
      originals.set(child, orig);
      const flash = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 3,
      });
      child.material = flash;
    }
  });

  activeFlashes.push({ shipId, timer: FLASH_DURATION, originals });
}

export function updateHitFlashes(dt: number): void {
  for (let i = activeFlashes.length - 1; i >= 0; i--) {
    const entry = activeFlashes[i];
    entry.timer -= dt;
    if (entry.timer <= 0) {
      // Restore original materials and dispose flash clones
      for (const [mesh, orig] of entry.originals) {
        (mesh.material as THREE.Material).dispose();
        mesh.material = orig;
      }
      activeFlashes.splice(i, 1);
    }
  }
}
