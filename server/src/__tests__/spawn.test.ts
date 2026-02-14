import { describe, it, expect } from 'vitest';
import { randomSpawnPosition } from '../spawn.js';

describe('randomSpawnPosition', () => {
  it('spawns within expected radius range (80–130)', () => {
    for (let i = 0; i < 50; i++) {
      const s = randomSpawnPosition();
      const radius = Math.sqrt(s.x * s.x + s.z * s.z);
      expect(radius).toBeGreaterThanOrEqual(80);
      expect(radius).toBeLessThanOrEqual(130);
    }
  });

  it('y is within ±20', () => {
    for (let i = 0; i < 50; i++) {
      const s = randomSpawnPosition();
      expect(s.y).toBeGreaterThanOrEqual(-20);
      expect(s.y).toBeLessThanOrEqual(20);
    }
  });

  it('yaw faces away from origin', () => {
    for (let i = 0; i < 50; i++) {
      const s = randomSpawnPosition();
      expect(s.yaw).toBeCloseTo(Math.atan2(-s.x, -s.z));
    }
  });

  it('pitch is always 0', () => {
    for (let i = 0; i < 50; i++) {
      const s = randomSpawnPosition();
      expect(s.pitch).toBe(0);
    }
  });
});
