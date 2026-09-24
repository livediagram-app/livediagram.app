import { describe, expect, it } from 'vitest';
import { eventStormingNote } from '@livediagram/diagram';
import { hexToRgb, type ImageBuffer } from './colour';
import { detectStickies } from './detect';

// Telling touching notes apart, end to end: each image is drawn by the test,
// on a wall of single notes so the detector measures a real note size.

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

const orange = eventStormingNote('domain-event').fill;

// Seven single notes along the top: the wall's note size is 60px.
function wall(): ImageBuffer {
  const image = blank(700, 420);
  for (let i = 0; i < 7; i += 1) rect(image, 30 + i * 95, 40, 60, 60, orange);
  return image;
}

const centreIn = (s: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
  x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;

describe('separating lapped notes', () => {
  it('cuts two offset notes lapped too far to be long enough for the splitter', () => {
    // 100x78 together: 1.67 notes long, under the length rule's 1.8, but the
    // outline has a notch each side of the seam.
    const image = wall();
    rect(image, 300, 300, 60, 60, orange);
    rect(image, 340, 318, 60, 60, orange);
    const found = detectStickies(image).filter((s) => s.y > 200);
    expect(found).toHaveLength(2);
    for (const s of found) {
      expect(centreIn(s, 330, 330) && centreIn(s, 370, 348)).toBe(false);
    }
  });
});
