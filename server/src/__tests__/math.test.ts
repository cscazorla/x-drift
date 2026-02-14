import { describe, it, expect } from 'vitest';
import { normalizeAngle, distanceSq } from '@x-drift/shared';

describe('normalizeAngle', () => {
  it('returns angle already in range unchanged', () => {
    expect(normalizeAngle(1)).toBeCloseTo(1);
    expect(normalizeAngle(-1)).toBeCloseTo(-1);
    expect(normalizeAngle(0)).toBeCloseTo(0);
  });

  it('wraps positive angle greater than PI', () => {
    expect(normalizeAngle(Math.PI + 0.5)).toBeCloseTo(-Math.PI + 0.5);
  });

  it('wraps negative angle less than -PI', () => {
    expect(normalizeAngle(-Math.PI - 0.5)).toBeCloseTo(Math.PI - 0.5);
  });

  it('handles boundary values', () => {
    expect(normalizeAngle(Math.PI)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(-Math.PI)).toBeCloseTo(-Math.PI);
  });

  it('wraps large positive multiples', () => {
    expect(normalizeAngle(5 * Math.PI)).toBeCloseTo(Math.PI);
  });

  it('wraps large negative multiples', () => {
    expect(normalizeAngle(-5 * Math.PI)).toBeCloseTo(-Math.PI);
  });
});

describe('distanceSq', () => {
  it('returns 0 for same point', () => {
    const p = { x: 3, y: 4, z: 5 };
    expect(distanceSq(p, p)).toBe(0);
  });

  it('computes axis-aligned distance squared', () => {
    expect(distanceSq({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 })).toBe(9);
    expect(distanceSq({ x: 0, y: 0, z: 0 }, { x: 0, y: 4, z: 0 })).toBe(16);
    expect(distanceSq({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 5 })).toBe(25);
  });

  it('computes 3D diagonal distance squared', () => {
    expect(distanceSq({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 3 })).toBe(14);
  });

  it('is commutative', () => {
    const a = { x: 1, y: 2, z: 3 };
    const b = { x: 4, y: 5, z: 6 };
    expect(distanceSq(a, b)).toBe(distanceSq(b, a));
  });
});
