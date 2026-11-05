import { describe, expect, it } from 'vitest';
import { FLOOR_PATTERNS } from '@livehuddle/document';
import { floorTile, isDarkCanvas } from './floor-tiles';

// docs/specs/011-theme/floors.md: every floor is one small SVG tile, a light and a dark version, quiet enough that
// what stands on it reads.

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const coloursOf = (inner: string): string[] => [...new Set(inner.match(/#[0-9a-f]{6}/gi) ?? [])];

describe('floorTile', () => {
  it('draws every floor in both halves, the dark one different from the light one', () => {
    for (const floor of FLOOR_PATTERNS) {
      const light = floorTile(floor, false);
      const dark = floorTile(floor, true);
      expect(light.w, floor).toBeGreaterThan(0);
      expect(light.h, floor).toBeGreaterThan(0);
      expect([dark.w, dark.h], floor).toEqual([light.w, light.h]);
      expect(dark.inner, floor).not.toBe(light.inner);
    }
  });

  it('is deterministic and cached: the same object every time', () => {
    expect(floorTile('grass', false)).toBe(floorTile('grass', false));
    expect(floorTile('terrazzo', true).inner).toBe(floorTile('terrazzo', true).inner);
  });

  it('keeps every tile small (under 12 KB of SVG), so the data URI stays cheap to decode', () => {
    let total = 0;
    for (const floor of FLOOR_PATTERNS)
      for (const dark of [false, true]) {
        const bytes = floorTile(floor, dark).inner.length;
        expect(bytes, `${floor} ${dark ? 'dark' : 'light'}`).toBeLessThan(12_000);
        total += bytes;
      }
    expect(total).toBeLessThan(200_000);
  });

  it('stays quiet: a light floor is light and a dark floor dark, all its tones close together', () => {
    for (const floor of FLOOR_PATTERNS) {
      const light = coloursOf(floorTile(floor, false).inner).map(luminance);
      const dark = coloursOf(floorTile(floor, true).inner).map(luminance);
      // Decking's gaps and the grout or mortar between stones are the deepest tones a floor has.
      expect(Math.min(...light), floor).toBeGreaterThan(0.55);
      expect(Math.max(...dark), floor).toBeLessThan(0.32);
      // The floor's bulk: most of its tones sit within a narrow band.
      const lightSpread = Math.max(...light) - Math.min(...light);
      expect(lightSpread, floor).toBeLessThan(0.35);
    }
  });

  it('stays inside its tile, or crosses an edge only to carry on from the far side', () => {
    // Every coordinate a tile writes, with its copies, lies within one tile's reach of the tile.
    for (const floor of FLOOR_PATTERNS) {
      const tile = floorTile(floor, false);
      for (const [, x, y] of tile.inner.matchAll(/x='(-?[\d.]+)' y='(-?[\d.]+)'/g)) {
        expect(Number(x), floor).toBeGreaterThan(-tile.w);
        expect(Number(x), floor).toBeLessThan(tile.w);
        expect(Number(y), floor).toBeGreaterThan(-tile.h);
        expect(Number(y), floor).toBeLessThan(tile.h);
      }
    }
  });
});

describe('isDarkCanvas', () => {
  it('reads the canvas half from its colour', () => {
    expect(isDarkCanvas('#ffffff')).toBe(false);
    expect(isDarkCanvas('#f8fafc')).toBe(false);
    expect(isDarkCanvas('#0f172a')).toBe(true);
    expect(isDarkCanvas('#1c2735')).toBe(true);
    expect(isDarkCanvas('#000')).toBe(true);
    expect(isDarkCanvas('fff')).toBe(false);
  });

  it('counts a colour it cannot read as light', () => {
    expect(isDarkCanvas('white')).toBe(false);
    expect(isDarkCanvas('rgb(0, 0, 0)')).toBe(false);
  });
});
