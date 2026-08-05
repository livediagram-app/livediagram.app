import { describe, expect, it } from 'vitest';
import { isDragTravel, PRESS_DRAG_SLOP_PX } from './press-gestures';

describe('isDragTravel', () => {
  it('treats no movement and a sub-slop nudge as a press', () => {
    expect(isDragTravel(0, 0)).toBe(false);
    expect(isDragTravel(3, 0)).toBe(false);
    expect(isDragTravel(0, -3)).toBe(false);
  });

  it('treats travel at or past the slop as a drag', () => {
    expect(isDragTravel(PRESS_DRAG_SLOP_PX, 0)).toBe(true);
    expect(isDragTravel(0, PRESS_DRAG_SLOP_PX)).toBe(true);
    expect(isDragTravel(40, -12)).toBe(true);
  });

  it('is direction-blind: the tolerance is a circle, not a square', () => {
    // The bug this replaced. One control tested each axis separately, so a
    // diagonal slip of (4, 4) — 5.66px of actual travel — stayed a click there
    // while every other control had already called it a drag.
    expect(isDragTravel(4, 4)).toBe(true);
    expect(isDragTravel(-4, 4)).toBe(true);
    // A pure-axis move of the same magnitude reads the same way, which is the
    // point: the same finger movement means the same thing in any direction.
    expect(isDragTravel(5.66, 0)).toBe(true);
  });

  it('agrees with the radial distance at the boundary in every quadrant', () => {
    for (const [dx, dy] of [
      [1, 1],
      [-2, 3],
      [3, -3],
      [-3, -2],
    ] as const) {
      expect(isDragTravel(dx, dy)).toBe(Math.hypot(dx, dy) >= PRESS_DRAG_SLOP_PX);
    }
  });
});

describe('PRESS_DRAG_SLOP_PX', () => {
  it('is small enough to stay invisible and big enough to absorb a slip', () => {
    // Guards against an accidental order-of-magnitude edit rather than pinning
    // the exact value: a 0 would make every click a drag, a 40 would make
    // dragging feel broken.
    expect(PRESS_DRAG_SLOP_PX).toBeGreaterThan(1);
    expect(PRESS_DRAG_SLOP_PX).toBeLessThan(10);
  });
});
