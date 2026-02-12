import * as THREE from 'three';

const shipCache = new Map<string, THREE.Group>();

function createShip(
  scene: THREE.Scene,
  id: string,
  isLocal: boolean,
): THREE.Group {
  const primary = isLocal ? 0x00ff88 : 0xff4444;
  const accent = isLocal ? 0x006633 : 0x661111;
  const glow = isLocal ? 0x00ffcc : 0xff6600;

  const group = new THREE.Group();

  // Fuselage
  const fuselage = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.25, 1.4),
    new THREE.MeshStandardMaterial({ color: primary }),
  );
  group.add(fuselage);

  // Nose
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.5, 4),
    new THREE.MeshStandardMaterial({ color: primary }),
  );
  nose.position.set(0, 0, -0.95);
  nose.rotation.x = -Math.PI / 2;
  group.add(nose);

  // Left wing
  const leftWing = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.05, 0.6),
    new THREE.MeshStandardMaterial({ color: primary }),
  );
  leftWing.position.set(-0.5, 0, 0.05);
  group.add(leftWing);

  // Right wing
  const rightWing = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.05, 0.6),
    new THREE.MeshStandardMaterial({ color: primary }),
  );
  rightWing.position.set(0.5, 0, 0.05);
  group.add(rightWing);

  // Left engine
  const leftEngine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: accent }),
  );
  leftEngine.position.set(-0.8, 0, 0.1);
  leftEngine.rotation.x = Math.PI / 2;
  group.add(leftEngine);

  // Right engine
  const rightEngine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: accent }),
  );
  rightEngine.position.set(0.8, 0, 0.1);
  rightEngine.rotation.x = Math.PI / 2;
  group.add(rightEngine);

  // Exhaust
  const exhaust = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshStandardMaterial({
      color: glow,
      emissive: glow,
      emissiveIntensity: 2,
    }),
  );
  exhaust.position.set(0, 0, 0.72);
  group.add(exhaust);

  scene.add(group);
  shipCache.set(id, group);
  return group;
}

export function getOrCreateShip(
  scene: THREE.Scene,
  id: string,
  isLocal: boolean,
): THREE.Group {
  return shipCache.get(id) ?? createShip(scene, id, isLocal);
}

export function removeShip(scene: THREE.Scene, id: string): void {
  const group = shipCache.get(id);
  if (!group) return;

  scene.remove(group);
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  });
  shipCache.delete(id);
}

export function getShipIds(): IterableIterator<string> {
  return shipCache.keys();
}
