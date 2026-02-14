import * as THREE from 'three';

const shipCache = new Map<string, THREE.Group>();
const shipGlowColor = new Map<string, number>();

const BRAKE_COLOR = 0xff2200;

export const teamColors = [
  { primary: 0x00ff88, accent: 0x006633, glow: 0x00ffcc }, // green
  { primary: 0xff4444, accent: 0x661111, glow: 0xff6666 }, // red
];

// Brighter variants for the local player
const localTeamColors = [
  { primary: 0x66ffbb, accent: 0x009955, glow: 0x88ffdd }, // bright green
  { primary: 0xff8888, accent: 0xaa3333, glow: 0xffaaaa }, // bright red
];

function createShip(scene: THREE.Scene, id: string, team: number, isLocal: boolean): THREE.Group {
  const palette = isLocal ? localTeamColors : teamColors;
  const c = palette[team] ?? palette[0];
  const primary = c.primary;
  const accent = c.accent;
  const glow = c.glow;

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
    new THREE.MeshStandardMaterial({ color: accent, emissive: glow, emissiveIntensity: 0 }),
  );
  leftEngine.position.set(-0.8, 0, 0.1);
  leftEngine.rotation.x = Math.PI / 2;
  group.add(leftEngine);

  // Right engine
  const rightEngine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: accent, emissive: glow, emissiveIntensity: 0 }),
  );
  rightEngine.position.set(0.8, 0, 0.1);
  rightEngine.rotation.x = Math.PI / 2;
  group.add(rightEngine);

  // Exhaust (hidden by default, shown when thrusting)
  const exhaust = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshStandardMaterial({
      color: glow,
      emissive: glow,
      emissiveIntensity: 2,
    }),
  );
  exhaust.position.set(0, 0, 0.72);
  exhaust.visible = false;
  group.add(exhaust);

  scene.add(group);
  shipCache.set(id, group);
  shipGlowColor.set(id, glow);
  return group;
}

export function getOrCreateShip(
  scene: THREE.Scene,
  id: string,
  team: number,
  isLocal: boolean,
): THREE.Group {
  return shipCache.get(id) ?? createShip(scene, id, team, isLocal);
}

export function removeShip(scene: THREE.Scene, id: string): void {
  const group = shipCache.get(id);
  if (!group) return;

  scene.remove(group);
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  });
  shipCache.delete(id);
  shipGlowColor.delete(id);
}

export function getShipIds(): IterableIterator<string> {
  return shipCache.keys();
}

export function getShip(id: string): THREE.Group | undefined {
  return shipCache.get(id);
}

const ENGINE_LEFT_IDX = 4;
const ENGINE_RIGHT_IDX = 5;
const EXHAUST_IDX = 6;

export function setThrustState(id: string, state: 'idle' | 'forward' | 'brake'): void {
  const group = shipCache.get(id);
  if (!group) return;

  const leftEngine = group.children[ENGINE_LEFT_IDX] as THREE.Mesh;
  const rightEngine = group.children[ENGINE_RIGHT_IDX] as THREE.Mesh;
  const exhaust = group.children[EXHAUST_IDX] as THREE.Mesh;

  const lMat = leftEngine.material as THREE.MeshStandardMaterial;
  const rMat = rightEngine.material as THREE.MeshStandardMaterial;
  const eMat = exhaust.material as THREE.MeshStandardMaterial;

  if (state === 'idle') {
    lMat.emissiveIntensity = 0;
    rMat.emissiveIntensity = 0;
    exhaust.visible = false;
  } else {
    const color = state === 'forward' ? shipGlowColor.get(id)! : BRAKE_COLOR;
    lMat.emissive.set(color);
    rMat.emissive.set(color);
    lMat.emissiveIntensity = 0.5;
    rMat.emissiveIntensity = 0.5;
    eMat.color.set(color);
    eMat.emissive.set(color);
    exhaust.visible = true;
  }
}
