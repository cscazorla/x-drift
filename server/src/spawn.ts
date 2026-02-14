/** Generate a random spawn position facing away from the origin. */
export function randomSpawnPosition(): {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
} {
  const spawnAngle = Math.random() * 2 * Math.PI;
  const spawnRadius = 80 + Math.random() * 50;
  const x = Math.cos(spawnAngle) * spawnRadius;
  const y = (Math.random() - 0.5) * 40;
  const z = Math.sin(spawnAngle) * spawnRadius;
  const yaw = Math.atan2(-x, -z); // face away from origin
  return { x, y, z, yaw, pitch: 0 };
}
