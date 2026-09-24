import { describe, expect, it } from 'vitest';
import { IGNORE, sampleTile, type TileSource } from './tile';

function source(width: number, height: number): TileSource {
  const rgb = new Uint8Array(width * height * 3);
  const classes = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p += 1) {
    rgb[p * 3] = p % 256;
    rgb[p * 3 + 1] = (p >> 8) % 256;
    classes[p] = p % 3;
  }
  return { width, height, rgb, classes };
}

describe('sampleTile', () => {
  it('copies a plain crop exactly at scale 1 with no transform', () => {
    const src = source(40, 30);
    const tile = sampleTile(src, 8, { originX: 5, originY: 7, scale: 1, transform: 0 });
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const s = (7 + y) * 40 + 5 + x;
        expect(tile.classes[y * 8 + x]).toBe(src.classes[s]);
        expect(tile.rgb[(y * 8 + x) * 3]).toBe(src.rgb[s * 3]);
      }
    }
  });

  it('moves colour and class together under every flip and turn', () => {
    const src: TileSource = {
      width: 8,
      height: 8,
      rgb: new Uint8Array(8 * 8 * 3),
      classes: new Uint8Array(8 * 8),
    };
    src.rgb[(1 * 8 + 2) * 3] = 200;
    src.classes[1 * 8 + 2] = 1;
    for (let t = 0; t < 8; t += 1) {
      const tile = sampleTile(src, 8, { originX: 0, originY: 0, scale: 1, transform: t });
      const at = tile.classes.indexOf(1);
      expect(at, `transform ${t}`).toBeGreaterThanOrEqual(0);
      expect(tile.rgb[at * 3]).toBe(200);
    }
  });

  it('marks pixels beyond the source as ignored', () => {
    const tile = sampleTile(source(10, 10), 8, { originX: 6, originY: 0, scale: 1, transform: 0 });
    expect(tile.classes[0]).not.toBe(IGNORE);
    expect(tile.classes[7]).toBe(IGNORE);
  });

  it('zooms in when the scale is above one', () => {
    const src = source(40, 40);
    const tile = sampleTile(src, 8, { originX: 0, originY: 0, scale: 2, transform: 0 });
    expect(tile.classes[0]).toBe(tile.classes[1]);
  });
});
