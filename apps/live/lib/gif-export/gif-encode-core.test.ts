import { describe, expect, it } from 'vitest';
import { createGifWriter, indexFrame, pagePalette, sampleFrameBytes } from './gif-encode-core';

// docs/specs/020-import-export/blueprints/animated-gif-export.md "The encoder".
const W = 8;
const H = 4;
const solid = (r: number, g: number, b: number) => {
  const px = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < px.length; i += 4) px.set([r, g, b, 255], i);
  return px;
};

// Each frame's delay (centiseconds), read from its Graphic Control Extension (21 F9 04 <flags> <delay lo> <hi>).
function delaysOf(bytes: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < bytes.length - 6; i += 1)
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 4)
      out.push(bytes[i + 4]! | (bytes[i + 5]! << 8));
  return out;
}
const text = (bytes: Uint8Array) => String.fromCharCode(...bytes);

describe('the GIF writer', () => {
  it('writes a GIF that loops forever', () => {
    const gif = createGifWriter(W, H);
    gif.add(solid(255, 0, 0), 7);
    gif.add(solid(0, 0, 255), 6);
    const bytes = gif.finish();
    expect(text(bytes.slice(0, 6))).toBe('GIF89a');
    expect(text(bytes)).toContain('NETSCAPE2.0');
    expect(bytes[bytes.length - 1]).toBe(0x3b);
    expect(delaysOf(bytes)).toEqual([7, 6]);
  });

  it('adds a repeated frame’s time to the frame before rather than writing it', () => {
    const gif = createGifWriter(W, H);
    gif.add(solid(255, 0, 0), 7);
    gif.add(solid(255, 0, 0), 6);
    gif.add(solid(255, 0, 0), 7);
    gif.add(solid(0, 255, 0), 300);
    const bytes = gif.finish();
    expect(gif.written).toBe(2);
    expect(delaysOf(bytes)).toEqual([20, 300]);
  });

  it('writes every frame of a page in the palette it is given', () => {
    const palette = pagePalette([solid(255, 0, 0), solid(0, 0, 255)]);
    const gif = createGifWriter(W, H);
    gif.add(solid(255, 0, 0), 7, palette);
    gif.add(solid(0, 0, 255), 7, palette);
    const bytes = gif.finish();
    // The palette's colours are in the file, red and blue among them.
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    expect(hex).toContain('ff0000');
    expect(hex).toContain('0000ff');
    expect(gif.written).toBe(2);
  });

  it('sizes a sample frame for the estimate', () => {
    expect(sampleFrameBytes(solid(10, 20, 30), W, H)).toBeGreaterThan(20);
  });
});

describe('a page palette and its lookup (spec "Colours hold still")', () => {
  it('finds the colours of every sample', () => {
    const palette = pagePalette([solid(250, 10, 10), solid(10, 10, 250)]);
    const near = (r: number, g: number, b: number) =>
      palette.some((c) => Math.abs(c[0]! - r) + Math.abs(c[1]! - g) + Math.abs(c[2]! - b) < 12);
    expect(near(250, 10, 10)).toBe(true);
    expect(near(10, 10, 250)).toBe(true);
  });

  it('gives a colour the same entry whatever frame it is in or what comes first', () => {
    const palette = [
      [100, 100, 100],
      [108, 100, 100],
    ];
    const px = (...cols: number[][]) => new Uint8ClampedArray(cols.flatMap((c) => [...c, 255]));
    // 104 sits between the two entries; 105 shares its 5-6-5 bucket. Either order, one answer.
    const a = indexFrame(px([104, 100, 100], [105, 100, 100]), palette);
    const b = indexFrame(px([105, 100, 100], [104, 100, 100]), palette);
    expect(a[0]).toBe(a[1]);
    expect(b[0]).toBe(a[0]);
  });
});
