import { describe, expect, it } from 'vitest';
import { CLASS } from '../mask';
import { syntheticWall } from './wall';

describe('syntheticWall', () => {
  it('is a pure function of its seed', () => {
    const a = syntheticWall(7, 96, 80);
    const b = syntheticWall(7, 96, 80);
    expect(a.rgb).toEqual(b.rgb);
    expect(a.classes).toEqual(b.classes);
    expect(a.boxes).toEqual(b.boxes);
  });

  it('differs between seeds', () => {
    expect(syntheticWall(1, 64, 64).rgb).not.toEqual(syntheticWall(2, 64, 64).rgb);
  });

  it('emits an RGB image and a three-class mask of the asked size', () => {
    const wall = syntheticWall(3, 96, 80);
    expect(wall.rgb).toHaveLength(96 * 80 * 3);
    expect(wall.classes).toHaveLength(96 * 80);
    expect([...wall.classes].every((c) => c <= CLASS.seam)).toBe(true);
  });

  it('gives every boxed note a core inside its box', () => {
    for (const seed of [11, 12, 13]) {
      const wall = syntheticWall(seed, 96, 96, { noteSize: 24 });
      expect(wall.boxes.length).toBeGreaterThan(0);
      for (const box of wall.boxes) {
        let core = 0;
        for (let y = box.y; y < box.y + box.h; y += 1) {
          for (let x = box.x; x < box.x + box.w; x += 1) {
            if (wall.classes[y * 96 + x] === CLASS.core) core += 1;
          }
        }
        expect(core, `seed ${seed} box ${JSON.stringify(box)}`).toBeGreaterThan(0);
      }
    }
  });
});
