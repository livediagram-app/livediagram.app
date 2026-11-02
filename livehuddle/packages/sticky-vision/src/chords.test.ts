import { describe, expect, it } from 'vitest';
import { cutAtNotches } from './chords';
import type { Box, PaperMask } from './boxes';

// Cutting a blob of two lapped notes along the chord between the notches
// where their outlines meet. Every mask here is drawn by the test.

function mask(width: number, height: number) {
  const classes = new Uint8Array(width * height);
  const fill = (x: number, y: number, w: number, h: number, c = 1) => {
    for (let yy = y; yy < y + h; yy += 1)
      for (let xx = x; xx < x + w; xx += 1) classes[yy * width + xx] = c;
  };
  const m: PaperMask = { width, height, classes };
  return { m, fill };
}

function boxOver(m: PaperMask, classId = 1): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  let pixels = 0;
  for (let y = 0; y < m.height; y += 1)
    for (let x = 0; x < m.width; x += 1) {
      if (m.classes[y * m.width + x] !== classId) continue;
      pixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  return { classId, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, pixels };
}

describe('cutAtNotches', () => {
  it('cuts two offset notes apart at the seam between their notches', () => {
    const { m, fill } = mask(120, 80);
    fill(10, 10, 40, 40);
    fill(50, 22, 40, 40);
    const pieces = cutAtNotches(boxOver(m), m, 40);
    expect(pieces).toHaveLength(2);
    const [left, right] = [...pieces].sort((a, b) => a.x - b.x);
    expect(left).toMatchObject({ x: 10, y: 10, h: 40 });
    expect(Math.abs(left!.w - 40)).toBeLessThanOrEqual(2);
    expect(right).toMatchObject({ y: 22, h: 40 });
    expect(Math.abs(right!.x + right!.w - 90)).toBeLessThanOrEqual(1);
  });

  it('leaves a plain rectangle alone', () => {
    const { m, fill } = mask(100, 60);
    fill(10, 10, 60, 40);
    const box = boxOver(m);
    expect(cutAtNotches(box, m, 40)).toEqual([box]);
  });

  it('does not cut off a sliver: both sides must be note-sized', () => {
    // A note with a small tab lapped onto its side: notches, but the far side
    // of the chord is a scrap, not a note.
    const { m, fill } = mask(100, 80);
    fill(10, 10, 40, 40);
    fill(50, 20, 8, 20);
    const box = boxOver(m);
    expect(cutAtNotches(box, m, 40)).toEqual([box]);
  });

  it('ignores the paper of another colour', () => {
    const { m, fill } = mask(120, 80);
    fill(10, 10, 40, 40);
    fill(50, 22, 40, 40, 2);
    const box = boxOver(m);
    expect(cutAtNotches(box, m, 40)).toEqual([box]);
  });
});
