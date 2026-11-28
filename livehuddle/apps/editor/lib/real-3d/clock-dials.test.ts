import { describe, expect, it } from 'vitest';
import { buildModel } from './models';
import { CLOCK_Z } from './models/outdoor';
import { RISE } from './models/kit';
import { pieceFrame } from './piece-frame';

// social-pieces.md "Clock": one round dial at the viewer's own local time, fitted to the box's smaller side.
const frame = (width: number, height: number) =>
  pieceFrame({ id: 'c', shape: 'world-clock', x: 0, y: 0, width, height });
const build = (width: number, height: number, clock?: { hour: number; minute: number }) =>
  buildModel('world-clock', { f: frame(width, height), t: {} as never, seats: [], clock });

// The model's extent across (x) and up (z), as built.
function extent(positions: readonly number[]) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    x0 = Math.min(x0, positions[i]!);
    x1 = Math.max(x1, positions[i]!);
    z0 = Math.min(z0, positions[i + 2]!);
    z1 = Math.max(z1, positions[i + 2]!);
  }
  return { w: x1 - x0, x0, x1, z0, z1 };
}

describe('the Clock model', () => {
  it('draws its hands only with a time, and moves them with the minute', () => {
    const bare = build(64, 64);
    const ten = build(64, 64, { hour: 10, minute: 10 });
    const later = build(64, 64, { hour: 10, minute: 40 });
    expect(ten.positions.length).toBeGreaterThan(bare.positions.length);
    expect(later.positions.length).toBe(ten.positions.length);
    expect(later.positions).not.toEqual(ten.positions);
  });

  it('is round as seen and centred, at the default size', () => {
    const e = extent(build(64, 64, { hour: 3, minute: 0 }).positions);
    expect(e.w).toBeCloseTo(48, 0);
    expect(Math.abs(e.x0 + e.x1)).toBeLessThan(0.5);
    // Its height as built is its width under RISE, the nail just above, its middle at CLOCK_Z.
    expect((CLOCK_Z - e.z0) * RISE).toBeCloseTo(24, 0);
  });

  it("fits an old World Clock's 168 x 72 box by its smaller side: one round clock, not a stretched one", () => {
    const old = extent(build(168, 72, { hour: 9, minute: 5 }).positions);
    expect(old.w).toBeCloseTo(48, 0);
    const small = extent(build(40, 40, { hour: 9, minute: 5 }).positions);
    expect(small.w).toBeCloseTo(32, 0);
  });
});
