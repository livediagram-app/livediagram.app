import { describe, expect, it } from 'vitest';
import { AVATAR_CAMERA_HALF_LIFE, centredCamera } from './walk';

// docs/specs/008-canvas/avatar-mode.md "The camera".
describe('centredCamera', () => {
  const size = { width: 1000, height: 800 };
  // The offset that puts a point in the middle of the view, at any zoom.
  const centredOn = (p: { x: number; y: number }) => ({ x: 500 - p.x, y: 400 - p.y });

  it('moves a centred view with every step, at any zoom', () => {
    for (const zoom of [0.5, 1, 2]) {
      const from = { x: 100, y: 100 };
      const to = { x: 130, y: 90 };
      expect(centredCamera(centredOn(from), from, to, size, zoom)).toEqual(centredOn(to));
    }
  });

  it('counts a view within a screen pixel as centred', () => {
    const from = { x: 100, y: 100 };
    const to = { x: 110, y: 100 };
    const nearly = { x: centredOn(from).x + 0.4, y: centredOn(from).y };
    expect(centredCamera(nearly, from, to, size, 2)).toEqual(centredOn(to));
  });

  it('waits while the character walks towards the middle of the view', () => {
    // Panned so the character stands 300 px left of the middle; walking right closes the gap itself.
    const from = { x: 0, y: 0 };
    const offset = { x: 200, y: 400 };
    expect(centredCamera(offset, from, { x: 20, y: 0 }, size, 1)).toBe(offset);
  });

  it('gravitates back by distance walked when walking away', () => {
    const from = { x: 0, y: 0 };
    const offset = { x: 200, y: 400 }; // character 300 px left of the middle
    const to = { x: -AVATAR_CAMERA_HALF_LIFE, y: 0 };
    const next = centredCamera(offset, from, to, size, 1);
    // Half the gap closed over one half-life of walking.
    expect(to.x + next.x - 500).toBeCloseTo(-150);
    expect(to.y + next.y - 400).toBeCloseTo(0);
  });

  it('never leaves the character further off the middle than it was', () => {
    // 250 px off the middle; walking down (a way that doesn't close the gap) only shrinks it.
    const from = { x: 0, y: 0 };
    const offset = { x: 250, y: 400 };
    const to = { x: 0, y: 50 };
    const next = centredCamera(offset, from, to, size, 2);
    expect(Math.hypot(to.x + next.x - 500, to.y + next.y - 400)).toBeLessThan(250);
  });

  it('decays a far-off view gently rather than snapping it back', () => {
    // Panned far away (character 2000 px off); walking away closes the gap a little.
    const from = { x: 0, y: 0 };
    const offset = { x: -1500, y: 400 };
    const next = centredCamera(offset, from, { x: -10, y: 0 }, size, 1);
    const gap = -10 + next.x - 500;
    expect(gap).toBeLessThan(-1900);
    expect(gap).toBeGreaterThan(-2000);
  });

  it('treats a zero zoom as 1', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 5, y: 5 };
    expect(centredCamera(centredOn(from), from, to, size, 0)).toEqual(centredOn(to));
  });
});
