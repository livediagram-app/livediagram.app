import { describe, expect, it } from 'vitest';
import { eventStormingNote } from '@livediagram/diagram';
import { hexToRgb, type ImageBuffer } from './colour';
import { detectStickies } from './detect';

// The seam cut at the size of the notes HERE (see `size-field.ts`), end to
// end: a wall of big notes with a pad of small ones in one corner.

function blank(width: number, height: number, fill = '#f1f3f5'): ImageBuffer {
  const { r, g, b } = hexToRgb(fill);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

function rect(image: ImageBuffer, x: number, y: number, w: number, h: number, hex: string) {
  const { r, g, b } = hexToRgb(hex);
  for (let yy = y; yy < y + h; yy += 1)
    for (let xx = x; xx < x + w; xx += 1) {
      const i = (yy * image.width + xx) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
    }
}

function darken(image: ImageBuffer, x: number, y: number, h: number, by: number) {
  for (let yy = y; yy < y + h; yy += 1) {
    const i = (yy * image.width + x) * 4;
    for (let c = 0; c < 3; c += 1) image.data[i + c] = Math.max(0, image.data[i + c]! - by);
  }
}

const orange = eventStormingNote('domain-event').fill;
const yellow = eventStormingNote('actor').fill;

describe('the seam cut at the local note size', () => {
  it('parts two small notes butted together in a pad of small notes', () => {
    // Big notes (60 px), three rows across the top, set the wall's size; twelve small
    // notes (30 px) fill the bottom right. Two more small notes sit flush
    // side by side among them, a line of shadow between: 60x30 together,
    // one wall note long, too short for a seam at the wall's size.
    const image = blank(1000, 600);
    for (let i = 0; i < 9; i += 1)
      for (let j = 0; j < 3; j += 1) rect(image, 30 + i * 105, 40 + j * 95, 60, 60, orange);
    for (let i = 0; i < 6; i += 1)
      for (let j = 0; j < 2; j += 1) rect(image, 560 + i * 45, 380 + j * 150, 30, 30, yellow);
    rect(image, 640, 455, 60, 30, yellow);
    darken(image, 670, 455, 30, 40);
    const inPair = detectStickies(image).filter((s) => s.y > 440 && s.y < 500);
    expect(inPair).toHaveLength(2);
    const centreIn = (s: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
      x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
    for (const s of inPair) expect(centreIn(s, 655, 470) && centreIn(s, 685, 470)).toBe(false);
  });
});
