import * as THREE from 'three';
import type { CelestialBody } from '@x-drift/shared';

export function createCelestialBodies(
  scene: THREE.Scene,
  bodies: CelestialBody[],
): THREE.Vector3 | null {
  let sunPos: THREE.Vector3 | null = null;

  for (const body of bodies) {
    if (body.type === 'sun') {
      // Sun sphere
      const geo = new THREE.SphereGeometry(body.radius, 32, 32);
      const mat = new THREE.MeshStandardMaterial({
        color: body.color,
        emissive: body.emissive ?? body.color,
        emissiveIntensity: 1.5,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(body.x, body.y, body.z);
      scene.add(mesh);

      // Glow shell
      const glowGeo = new THREE.SphereGeometry(body.radius * 1.15, 32, 32);
      const glowMat = new THREE.MeshBasicMaterial({
        color: body.emissive ?? body.color,
        transparent: true,
        opacity: 0.15,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(body.x, body.y, body.z);
      scene.add(glow);

      // Point light at sun position
      const light = new THREE.PointLight(0xfff5e6, 1.5, 0);
      light.position.set(body.x, body.y, body.z);
      scene.add(light);

      sunPos = new THREE.Vector3(body.x, body.y, body.z);
    } else {
      // Planet sphere
      const geo = new THREE.SphereGeometry(body.radius, 24, 24);
      const mat = new THREE.MeshStandardMaterial({ color: body.color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(body.x, body.y, body.z);
      scene.add(mesh);

      // Optional ring
      if (body.ring) {
        const ringGeo = new THREE.RingGeometry(
          body.ring.innerRadius,
          body.ring.outerRadius,
          64,
        );
        const ringMat = new THREE.MeshBasicMaterial({
          color: body.ring.color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.5,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(body.x, body.y, body.z);
        ring.rotation.x = Math.PI * (75 / 180); // ~75° tilt
        scene.add(ring);
      }
    }
  }

  return sunPos;
}
