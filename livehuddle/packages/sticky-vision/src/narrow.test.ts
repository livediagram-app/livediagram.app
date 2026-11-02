import { describe, expect, it } from 'vitest';
import { seamAcross } from './narrow';

// Is a narrow box one tall note, or two small ones the close fused together?
// The raw mask says: two notes leave a line of wall across the middle.

function maskOf(width: number, height: number, paint: (x: number, y: number) => boolean) {
  const classes = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) if (paint(x, y)) classes[y * width + x] = 3;
  return { width, height, classes };
}

const BOX = { classId: 3, x: 0, y: 0, w: 20, h: 46, pixels: 20 * 46 };

describe('seamAcross', () => {
  it('reads a solid tall note as whole', () => {
    expect(
      seamAcross(
        BOX,
        maskOf(20, 46, () => true),
      ),
    ).toBeGreaterThan(0.9);
  });

  it('finds the line of wall between two stacked squares', () => {
    expect(
      seamAcross(
        BOX,
        maskOf(20, 46, (_x, y) => y !== 22 && y !== 23),
      ),
    ).toBe(0);
  });

  it('is not fooled by handwriting that crosses part of the note', () => {
    const written = maskOf(20, 46, (x, y) => !(y === 22 && x > 3 && x < 14));
    expect(seamAcross(BOX, written)).toBeGreaterThan(0.4);
  });

  it('ignores a gap outside the middle of the long axis', () => {
    expect(
      seamAcross(
        BOX,
        maskOf(20, 46, (_x, y) => y !== 3),
      ),
    ).toBeGreaterThan(0.9);
  });

  it('reads across a wide box too', () => {
    const wide = { ...BOX, w: 46, h: 20 };
    expect(
      seamAcross(
        wide,
        maskOf(46, 20, (x) => x !== 23),
      ),
    ).toBe(0);
  });

  it('only counts paper of the box’s own colour', () => {
    expect(
      seamAcross(
        BOX,
        maskOf(20, 46, () => false),
      ),
    ).toBe(0);
  });
});
