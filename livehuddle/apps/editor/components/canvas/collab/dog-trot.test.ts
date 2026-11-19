// The office dog's trot as one compositor animation (docs/specs/009-elements/workday-pieces.md "Pet Bed and its dog",
// docs/specs/008-canvas/canvas-performance.md "A still Space does nothing").

import { describe, expect, it } from 'vitest';
import { dogAtTime, dogTrot } from './dog-trot';

describe('dogTrot', () => {
  it('stops at each corner at its share of the route, at a steady pace', () => {
    // 30 px right, then 40 px down: 70 px at 70 px a second.
    const trot = dogTrot(
      { x: 0, y: 0 },
      [
        { x: 30, y: 0 },
        { x: 30, y: 40 },
      ],
      70,
      false,
    );
    expect(trot.points).toEqual([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 40 },
    ]);
    expect(trot.offsets).toEqual([0, 30 / 70, 1]);
    expect(trot.ms).toBe(1000);
    // Already facing right: no turn.
    expect(trot.turns).toEqual([]);
  });

  it('turns as a leg heads the other way, never on a leg straight up or down', () => {
    const trot = dogTrot(
      { x: 0, y: 0 },
      [
        { x: -20, y: 0 },
        { x: -20, y: 30 },
        { x: 30, y: 30 },
      ],
      10,
      false,
    );
    expect(trot.turns).toEqual([
      { atMs: 0, left: true },
      { atMs: 5000, left: false },
    ]);
  });

  it('is over at once on a route of no length', () => {
    const trot = dogTrot({ x: 5, y: 5 }, [{ x: 5, y: 5 }], 70, true);
    expect(trot.ms).toBe(0);
    expect(trot.offsets).toEqual([1, 1]);
    expect(dogAtTime(trot, 0)).toEqual({ x: 5, y: 5 });
  });
});

describe('dogAtTime', () => {
  const trot = dogTrot(
    { x: 0, y: 0 },
    [
      { x: 30, y: 0 },
      { x: 30, y: 40 },
    ],
    70,
    false,
  );
  it('is where the animation has it along the route', () => {
    expect(dogAtTime(trot, 0)).toEqual({ x: 0, y: 0 });
    const along = dogAtTime(trot, 200);
    expect(along.x).toBeCloseTo(14);
    expect(along.y).toBe(0);
    const down = dogAtTime(trot, 750);
    expect(down.x).toBe(30);
    expect(down.y).toBeCloseTo(22.5);
  });
  it('holds its start before and its end after', () => {
    expect(dogAtTime(trot, -50)).toEqual({ x: 0, y: 0 });
    expect(dogAtTime(trot, 5000)).toEqual({ x: 30, y: 40 });
  });
});
