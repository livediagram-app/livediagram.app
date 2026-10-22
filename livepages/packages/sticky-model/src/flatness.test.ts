import { describe, expect, it } from 'vitest';
import { rngFrom } from './synth/rng';
import { syntheticWall } from './synth/wall';
import { FLAT_IMAGE_SHARE, flatShareOf, isFlatImage } from './flatness';

type Image = { width: number; height: number; data: Uint8ClampedArray };

function rgbaOf(width: number, height: number, rgb: Uint8Array): Image {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p += 1) {
    data.set([rgb[p * 3]!, rgb[p * 3 + 1]!, rgb[p * 3 + 2]!, 255], p * 4);
  }
  return { width, height, data };
}

function drawn(width: number, height: number): Image {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p += 1) data.set([241, 245, 249, 255], p * 4);
  for (let y = 20; y < 60; y += 1)
    for (let x = 20; x < 60; x += 1) data.set([253, 186, 116, 255], (y * width + x) * 4);
  return { width, height, data };
}

describe('flatShareOf', () => {
  it('is the share of pixels exactly equal to their right-hand neighbour', () => {
    const image = drawn(100, 80);
    // One colour step per row where the note starts and one where it ends,
    // on 40 of 80 rows: 80 of 99 * 80 pairs differ.
    expect(flatShareOf(image)).toBeCloseTo(1 - 80 / (99 * 80), 6);
  });

  it('is near zero for a photograph, noise in every pixel', () => {
    const rng = rngFrom(1);
    const data = new Uint8ClampedArray(64 * 64 * 4);
    for (let p = 0; p < 64 * 64; p += 1)
      data.set([200 + rng.int(-4, 4), 150 + rng.int(-4, 4), 90 + rng.int(-4, 4), 255], p * 4);
    expect(flatShareOf({ width: 64, height: 64, data })).toBeLessThan(0.05);
  });

  it('is zero for an image one pixel wide', () => {
    expect(flatShareOf({ width: 1, height: 3, data: new Uint8ClampedArray(12) })).toBe(0);
  });
});

describe('isFlatImage', () => {
  it('calls a drawn wall flat', () => {
    expect(isFlatImage(drawn(200, 120))).toBe(true);
  });

  // One test per seed, so each gets its own time budget on a slow runner.
  it.each(Array.from({ length: 12 }, (_, i) => i + 1))(
    'calls the generator’s flat wall flat and its photograph not (seed %i)',
    (seed) => {
      const flat = syntheticWall(seed, 256, 256, { style: 'flat' });
      const photo = syntheticWall(seed, 256, 256, { style: 'photo' });
      expect(isFlatImage(rgbaOf(256, 256, flat.rgb))).toBe(true);
      expect(isFlatImage(rgbaOf(256, 256, photo.rgb))).toBe(false);
    },
  );

  it('draws its line between the two, well clear of both', () => {
    expect(FLAT_IMAGE_SHARE).toBeGreaterThan(0.4);
    expect(FLAT_IMAGE_SHARE).toBeLessThan(0.8);
  });
});
