import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { GRASS_MOTTLE, GRASS_TILES, flagstone, gravelSpecks } from './garden-ground';

// docs/specs/009-elements/office.md "Garden Path", "Grass"; furniture-art-style.md.
describe("the garden's ground", () => {
  it('cuts each flagstone by hand inside its ellipse, the same every time', () => {
    const a = flagstone(50, 20, 18, 12, 4);
    expect(a).toBe(flagstone(50, 20, 18, 12, 4));
    expect(a).not.toBe(flagstone(50, 20, 18, 12, 5));
    const nums = a.match(/-?[\d.]+/g)!.map(Number);
    for (let i = 0; i < nums.length; i += 2) {
      expect(((nums[i]! - 50) / 18) ** 2 + ((nums[i + 1]! - 20) / 12) ** 2).toBeLessThanOrEqual(
        1.0001,
      );
    }
  });

  it('scatters gravel inside its bed, and never more than its cap however long the path', () => {
    const inside = (x: number, y: number) => x > 10 && x < 90 && y > 0 && y < 40;
    const { light, dark } = gravelSpecks(100, 40, 1, inside);
    const specks = `${light}${dark}`.split('M').filter(Boolean);
    expect(specks.length).toBeGreaterThan(20);
    for (const s of specks) {
      const [x, y] = s.split(/[ h]/).map(Number);
      expect(inside(x!, y!)).toBe(true);
    }
    let huge = { light: '', dark: '' };
    const ms = cpuMsOf(() => {
      huge = gravelSpecks(20000, 64, 2, () => true);
    });
    expect(`${huge.light}${huge.dark}`.split('M').length - 1).toBeLessThanOrEqual(900);
    expect(ms).toBeLessThan(40);
  });

  it('keeps every blade and patch inside its tile, so none is cut at a seam', () => {
    for (const tile of GRASS_TILES)
      for (const blade of `${tile.shade}${tile.light}`.split('M').filter(Boolean)) {
        const [x, y, , , ex, ey] = blade.split(/[ q]/).filter(Boolean).map(Number);
        for (const v of [x!, y!, x! + ex!, y! + ey!]) {
          expect(v).toBeGreaterThan(0);
          expect(v).toBeLessThan(tile.size);
        }
      }
    expect(GRASS_MOTTLE.lush.length).toBeGreaterThan(0);
    expect(GRASS_MOTTLE.thick.length).toBeGreaterThan(0);
  });
});
