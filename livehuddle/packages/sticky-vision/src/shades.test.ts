import { describe, expect, it } from 'vitest';
import { hexToRgb, type ImageBuffer } from './colour';
import { isPaleShade } from './classify';
import { detectStickies } from './detect';

// Two papers of one kind: the operator's walls carry a vivid blue command and
// a pale periwinkle one, and a note of each lapped side by side is two notes.

function wall(width: number, height: number, fill: string): ImageBuffer {
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

function paper(image: ImageBuffer, x: number, y: number, w: number, h: number, hex: string) {
  const { r, g, b } = hexToRgb(hex);
  for (let yy = y; yy < y + h; yy += 1)
    for (let xx = x; xx < x + w; xx += 1) {
      const i = (yy * image.width + xx) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
    }
}

const KRAFT = '#b29f92';
const VIVID_BLUE = '#10a0dc';
const PERIWINKLE = '#acace2';
const ORANGE = '#f0a040';
const WHITE_PAPER = '#dcd8cc';
const VIVID_PINK = '#d33558';
const PALE_PINK = '#e8b8cc';

describe('isPaleShade', () => {
  it('tells the pale periwinkle from the vivid blue', () => {
    expect(isPaleShade(172, 172, 226, 'command')).toBe(true);
    expect(isPaleShade(16, 160, 220, 'command')).toBe(false);
  });

  it('leaves a blue in shadow to the vivid blue it is the shade of', () => {
    expect(isPaleShade(86, 86, 113, 'command')).toBe(false);
  });

  it('tells a pale pink from the vivid pink of a hotspot', () => {
    expect(isPaleShade(232, 184, 204, 'hotspot')).toBe(true);
    expect(isPaleShade(211, 53, 88, 'hotspot')).toBe(false);
  });

  it('has no pale shade for the other kinds', () => {
    expect(isPaleShade(240, 200, 160, 'domain-event')).toBe(false);
  });
});

describe('detectStickies, two shades of one kind', () => {
  it('keeps a wide periwinkle note beside a vivid blue one as two notes', () => {
    const image = wall(1000, 563, KRAFT);
    // A wall of 50px notes, so the note size is measured.
    for (let i = 0; i < 6; i += 1) paper(image, 100 + i * 80, 350, 52, 52, ORANGE);
    paper(image, 200, 100, 88, 52, PERIWINKLE);
    paper(image, 288, 100, 52, 52, VIVID_BLUE);
    const blue = detectStickies(image).filter((s) => s.kind === 'command');
    expect(blue.map((s) => [s.x, s.w])).toEqual([
      [200, 88],
      [288, 52],
    ]);
  });

  it('keeps a wide pale pink note beside a vivid pink one as two notes', () => {
    const image = wall(1000, 563, WHITE_PAPER);
    for (let i = 0; i < 6; i += 1) paper(image, 100 + i * 80, 350, 52, 52, ORANGE);
    paper(image, 200, 100, 52, 52, VIVID_PINK);
    paper(image, 252, 100, 88, 52, PALE_PINK);
    const pink = detectStickies(image).filter((s) => s.kind === 'hotspot');
    expect(pink.map((s) => [s.x, s.w])).toEqual([
      [200, 52],
      [252, 88],
    ]);
  });
});
