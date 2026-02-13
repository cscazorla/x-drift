import * as THREE from 'three';
import type { CelestialBody } from '@x-drift/shared';

export function createCelestialBodies(
  scene: THREE.Scene,
  bodies: CelestialBody[],
): THREE.Vector3 | null {
  let sunPos: THREE.Vector3 | null = null;

  for (const body of bodies) {
    if (body.type === 'sun') {
      // Sun sphere — MeshBasicMaterial so it's uniformly bright (self-luminous)
      const emissiveColor = body.emissive ?? body.color;
      const geo = new THREE.SphereGeometry(body.radius, 32, 32);
      const mat = new THREE.MeshBasicMaterial({ color: emissiveColor });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(body.x, body.y, body.z);
      scene.add(mesh);

      // Layered corona for natural falloff
      const coronaLayers = [
        { scale: 1.08, opacity: 0.18, color: emissiveColor },
        { scale: 1.2, opacity: 0.08, color: 0xff8800 },
        { scale: 1.4, opacity: 0.03, color: 0xff4400 },
      ];
      for (const layer of coronaLayers) {
        const cGeo = new THREE.SphereGeometry(body.radius * layer.scale, 32, 32);
        const cMat = new THREE.MeshBasicMaterial({
          color: layer.color,
          transparent: true,
          opacity: layer.opacity,
        });
        const cMesh = new THREE.Mesh(cGeo, cMat);
        cMesh.position.set(body.x, body.y, body.z);
        scene.add(cMesh);
      }

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

      // Optional atmosphere
      if (body.atmosphere) {
        const atmGeo = new THREE.SphereGeometry(body.radius * body.atmosphere.scale, 32, 32);
        const atmMat = new THREE.MeshBasicMaterial({
          color: body.atmosphere.color,
          transparent: true,
          opacity: body.atmosphere.opacity,
          side: THREE.BackSide,
        });
        const atm = new THREE.Mesh(atmGeo, atmMat);
        atm.position.set(body.x, body.y, body.z);
        scene.add(atm);
      }

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
