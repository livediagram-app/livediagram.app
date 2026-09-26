import { describe, expect, it } from 'vitest';
import { cropFromStride, padToStride, rgbOf, UNET_STRIDE } from './stride';

// 3×2 RGBA: each pixel's red is its index, green 100 + index, blue 200 + index.
const rgba = new Uint8ClampedArray([0, 1, 2, 3, 4, 5].flatMap((i) => [i, 100 + i, 200 + i, 255]));

describe('rgbOf', () => {
  it('scales RGBA bytes to RGB in 0..1 and drops alpha', () => {
    expect(Array.from(rgbOf(rgba).subarray(0, 6))).toEqual(
      [0, 100 / 255, 200 / 255, 1 / 255, 101 / 255, 201 / 255].map(Math.fround),
    );
  });
});

describe('padToStride', () => {
  it('rounds both sides up to the stride', () => {
    const padded = padToStride(rgbOf(rgba), 3, 2, 4);
    expect([padded.width, padded.height]).toEqual([4, 4]);
    expect(padded.rgb).toHaveLength(4 * 4 * 3);
  });

  it('repeats the edge pixels into the padding, so the frame edge is no seam', () => {
    const { rgb, width } = padToStride(rgbOf(rgba), 3, 2, 4);
    const red = (x: number, y: number) => Math.round(rgb[(y * width + x) * 3]! * 255);
    expect(red(3, 0)).toBe(2);
    expect(red(0, 3)).toBe(3);
    expect(red(3, 3)).toBe(5);
  });

  it('pads to the network stride by default', () => {
    const padded = padToStride(new Float32Array(17 * 1 * 3), 17, 1);
    expect([padded.width, padded.height]).toEqual([2 * UNET_STRIDE, UNET_STRIDE]);
  });
});

describe('cropFromStride', () => {
  it('keeps the top-left width × height of every channel', () => {
    const padded = new Float32Array(4 * 2 * 3).map((_, i) => i);
    const out = cropFromStride(padded, 4, 3, 1);
    expect(Array.from(out)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
