import * as THREE from 'three';
import { getShip } from './ship';

const FLASH_DURATION = 0.15; // seconds
const DEATH_FLASH_DURATION = 0.5; // seconds

interface FlashEntry {
  shipId: string;
  timer: number;
  originals: Map<THREE.Mesh, THREE.Material>;
  isDeath?: boolean;
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
      const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
      const orig = mesh.material as THREE.MeshStandardMaterial;
      originals.set(mesh, orig);
      const flash = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 3,
      });
      mesh.material = flash;
    }
  });

  activeFlashes.push({ shipId, timer: FLASH_DURATION, originals });
}

export function triggerShieldAbsorb(shipId: string): void {
  // Anti-stacking: ignore if already flashing
  if (activeFlashes.some((f) => f.shipId === shipId)) return;

  const ship = getShip(shipId);
  if (!ship) return;

  const originals = new Map<THREE.Mesh, THREE.Material>();
  ship.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
      const orig = mesh.material as THREE.MeshStandardMaterial;
      originals.set(mesh, orig);
      const flash = new THREE.MeshStandardMaterial({
        color: 0x4488ff,
        emissive: 0x4488ff,
        emissiveIntensity: 3,
      });
      mesh.material = flash;
    }
  });

  activeFlashes.push({ shipId, timer: FLASH_DURATION, originals });
}

export function triggerDeathExplosion(shipId: string): void {
  // Remove any existing flash for this ship
  for (let i = activeFlashes.length - 1; i >= 0; i--) {
    if (activeFlashes[i].shipId === shipId) {
      for (const [mesh, orig] of activeFlashes[i].originals) {
        (mesh.material as THREE.Material).dispose();
        mesh.material = orig;
      }
      activeFlashes.splice(i, 1);
    }
  }

  const ship = getShip(shipId);
  if (!ship) return;

  const originals = new Map<THREE.Mesh, THREE.Material>();
  ship.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
      const orig = mesh.material as THREE.MeshStandardMaterial;
      originals.set(mesh, orig);
      const flash = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 5,
      });
      mesh.material = flash;
    }
  });

  ship.scale.set(2, 2, 2);
  activeFlashes.push({ shipId, timer: DEATH_FLASH_DURATION, originals, isDeath: true });
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
      if (entry.isDeath) {
        const ship = getShip(entry.shipId);
        if (ship) {
          ship.scale.set(1, 1, 1);
          ship.visible = false;
        }
      }
      activeFlashes.splice(i, 1);
    }
  }
}
