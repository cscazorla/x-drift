import * as THREE from 'three';

export function createStarfield(scene: THREE.Scene): THREE.Points {
  const count = 3000;
  const radius = 500;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    const i3 = i * 3;
    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = radius * Math.cos(phi);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0x888899,
    size: 1.5,
    sizeAttenuation: false,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return points;
}
