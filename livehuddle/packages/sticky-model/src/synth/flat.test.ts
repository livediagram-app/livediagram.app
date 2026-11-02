import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CLASS } from '../mask';
import { FLAT_CHANCE, syntheticWall, type SyntheticWall } from './wall';

// The flat style: a screenshot of a digital board or a drawn wall. Flat fills,
// crisp edges, no light, no noise.

const SIZE = 96;

// Share of pixels exactly equal to their right-hand neighbour: near 1 for a
// flat drawing, near 0 for a photograph with sensor noise.
function sameAsNeighbour(wall: SyntheticWall): number {
  let same = 0;
  let pairs = 0;
  for (let y = 0; y < wall.height; y += 1) {
    for (let x = 0; x + 1 < wall.width; x += 1) {
      const a = (y * wall.width + x) * 3;
      const b = a + 3;
      pairs += 1;
      if (
        wall.rgb[a] === wall.rgb[b] &&
        wall.rgb[a + 1] === wall.rgb[b + 1] &&
        wall.rgb[a + 2] === wall.rgb[b + 2]
      )
        same += 1;
    }
  }
  return same / pairs;
}

const luminance = (wall: SyntheticWall, p: number) =>
  (wall.rgb[p * 3]! + wall.rgb[p * 3 + 1]! + wall.rgb[p * 3 + 2]!) / 3;

describe('syntheticWall, flat style', () => {
  it('is drawn without noise or texture', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const wall = syntheticWall(seed, SIZE, SIZE, { style: 'flat' });
      expect(wall.style).toBe('flat');
      expect(sameAsNeighbour(wall), `seed ${seed}`).toBeGreaterThan(0.4);
      // A photograph's sensor noise leaves almost no two neighbours equal.
      const photo = syntheticWall(seed, SIZE, SIZE, { style: 'photo' });
      expect(sameAsNeighbour(photo), `seed ${seed}`).toBeLessThan(0.1);
    }
  });

  it('paints each note in one flat colour', () => {
    for (const seed of [21, 22, 23, 24]) {
      const wall = syntheticWall(seed, SIZE, SIZE, { style: 'flat', noteSize: 30 });
      expect(wall.boxes.length).toBeGreaterThan(0);
      const counts = new Map<number, Map<string, number>>();
      for (let p = 0; p < wall.classes.length; p += 1) {
        if (wall.classes[p] !== CLASS.core) continue;
        const key = `${wall.rgb[p * 3]},${wall.rgb[p * 3 + 1]},${wall.rgb[p * 3 + 2]}`;
        const box = wall.boxes.findIndex((b) => {
          const x = p % SIZE;
          const y = Math.floor(p / SIZE);
          return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
        });
        const m = counts.get(box) ?? new Map<string, number>();
        m.set(key, (m.get(key) ?? 0) + 1);
        counts.set(box, m);
      }
      for (const [box, m] of counts) {
        const total = [...m.values()].reduce((a, b) => a + b, 0);
        const top = Math.max(...m.values());
        expect(top / total, `seed ${seed} box ${box}`).toBeGreaterThan(0.5);
      }
    }
  });

  it('draws light and dark canvases', () => {
    const medians = Array.from({ length: 60 }, (_, i) => {
      const wall = syntheticWall(100 + i, 64, 64, { style: 'flat' });
      const bg: number[] = [];
      for (let p = 0; p < wall.classes.length; p += 1)
        if (wall.classes[p] === CLASS.background) bg.push(luminance(wall, p));
      bg.sort((a, b) => a - b);
      return bg[Math.floor(bg.length / 2)] ?? 128;
    });
    expect(medians.some((m) => m < 60)).toBe(true);
    expect(medians.some((m) => m > 220)).toBe(true);
  });

  it('draws notes larger than a photograph shows them', () => {
    const wall = syntheticWall(5, 256, 256, { style: 'flat', noteSize: 200 });
    expect(wall.boxes.some((b) => b.w >= 150 && b.h >= 150)).toBe(true);
    expect(wall.classes.includes(CLASS.core)).toBe(true);
  });
});

describe('syntheticWall, style draw', () => {
  it('draws the flat style for about FLAT_CHANCE of the seeds', () => {
    const n = 400;
    let flat = 0;
    for (let seed = 1; seed <= n; seed += 1)
      if (syntheticWall(seed, 16, 16).style === 'flat') flat += 1;
    expect(flat / n).toBeGreaterThan(FLAT_CHANCE - 0.06);
    expect(flat / n).toBeLessThan(FLAT_CHANCE + 0.06);
  });

  it('nests the flat walls of a smaller share inside a larger one', () => {
    const flatAt = (share: number) =>
      Array.from({ length: 200 }, (_, i) => i + 1).filter(
        (seed) => syntheticWall(seed, 16, 16, { flatChance: share }).style === 'flat',
      );
    const few = flatAt(0.1);
    const many = flatAt(0.3);
    expect(few.length).toBeGreaterThan(0);
    expect(many.length).toBeGreaterThan(few.length);
    expect(few.every((seed) => many.includes(seed))).toBe(true);
  });

  it('leaves every photographed wall exactly as the photo-only generator drew it', () => {
    // Hashes of the photo-only generator's walls (64px): adding the flat style
    // replaces some seeds with flat walls and changes no other wall, so a
    // model trained on the mix sees the very photographs it saw before.
    const photoOnly: Record<number, string> = {
      1: '290a1fb2349c6a05',
      2: '5200498ab3e95102',
      3: 'bc33c4c7a92ab2d1',
      4: '2cd860426c00065b',
      5: '83030d858e1a99bc',
      6: '482a524e92c64551',
      7: 'bf9ab90ef89a0c55',
      8: '480f899ef5d354e3',
      9: '61b8fd6e9cb0eb44',
      10: '41acf963a1bd2d2e',
      11: '2d4e69b32240ee92',
      12: 'ef45e7da8471c546',
    };
    let checked = 0;
    for (const [seed, hash] of Object.entries(photoOnly)) {
      const wall = syntheticWall(Number(seed), 64, 64);
      if (wall.style !== 'photo') continue;
      checked += 1;
      const got = createHash('sha256').update(wall.rgb).update(wall.classes).digest('hex');
      expect(got.slice(0, 16), `seed ${seed}`).toBe(hash);
    }
    expect(checked).toBeGreaterThan(6);
  });
});
