import { describe, expect, it } from 'vitest';
import { cutAtSeam, findSeam, type Luminance } from './seam';
import type { Box, PaperMask } from './boxes';

// Finding the SEAM between two notes that touch: the paper edge and its
// shadow, a line a little darker than the paper either side of it, all the
// way across. Handwriting is darker still and never runs all the way across.

function scene(width: number, height: number, paper = 200) {
  const lum: Luminance = { width, height, data: new Uint8Array(width * height).fill(90) };
  const mask: PaperMask = { width, height, classes: new Uint8Array(width * height) };
  const paint = (x: number, y: number, w: number, h: number, v: number, c?: number) => {
    for (let yy = y; yy < y + h; yy += 1)
      for (let xx = x; xx < x + w; xx += 1) {
        lum.data[yy * width + xx] = v;
        if (c !== undefined) mask.classes[yy * width + xx] = c;
      }
  };
  return { lum, mask, paint, paper };
}

const boxOf = (x: number, y: number, w: number, h: number): Box => ({
  classId: 1,
  x,
  y,
  w,
  h,
  pixels: w * h,
});

// Handwriting: short dark strokes, some upright, over the paper.
function scribble(paint: (x: number, y: number, w: number, h: number, v: number) => void) {
  for (const [x, y] of [
    [16, 18],
    [30, 22],
    [44, 30],
    [58, 18],
    [72, 34],
    [24, 42],
  ] as const) {
    paint(x, y, 8, 2, 40);
    paint(x + 3, y - 4, 2, 9, 40);
  }
}

describe('findSeam', () => {
  it('finds the shadow line between two flush notes', () => {
    const s = scene(100, 60);
    s.paint(10, 10, 80, 40, 200, 1);
    s.paint(49, 10, 2, 40, 165);
    scribble(s.paint);
    const seam = findSeam(s.lum, boxOf(10, 10, 80, 40), 40);
    expect(seam).not.toBeNull();
    expect(seam!.vertical).toBe(true);
    expect(Math.abs(seam!.at - 49.5)).toBeLessThanOrEqual(1.5);
  });

  it('finds none in one note covered in handwriting', () => {
    const s = scene(100, 60);
    s.paint(10, 10, 80, 40, 200, 1);
    scribble(s.paint);
    expect(findSeam(s.lum, boxOf(10, 10, 80, 40), 40)).toBeNull();
  });

  it('finds none across a box too short to be two notes', () => {
    // 1.2 notes long: a line across the middle leaves 0.6 of a note either
    // side, and one note with a crease or a line of writing across it is far
    // likelier than two notes that short.
    const s = scene(100, 60);
    s.paint(10, 10, 44, 40, 200, 1);
    s.paint(31, 10, 2, 40, 165);
    expect(findSeam(s.lum, boxOf(10, 10, 44, 40), 36)).toBeNull();
    // …while the same seam in a box two notes long is found.
    expect(findSeam(s.lum, boxOf(10, 10, 44, 40), 22)).not.toBeNull();
  });

  it('finds none nearer the edge than a note can be thin', () => {
    const s = scene(100, 60);
    s.paint(10, 10, 80, 40, 200, 1);
    s.paint(20, 10, 2, 40, 165);
    expect(findSeam(s.lum, boxOf(10, 10, 80, 40), 40)).toBeNull();
  });
});

describe('cutAtSeam', () => {
  it('cuts two flush notes into two, each tightened onto its paper', () => {
    const s = scene(100, 70);
    s.paint(10, 10, 40, 40, 200, 1);
    s.paint(50, 16, 40, 40, 200, 1);
    s.paint(49, 16, 2, 34, 165);
    const pieces = cutAtSeam(boxOf(10, 10, 80, 46), s.lum, s.mask, 40);
    expect(pieces).toHaveLength(2);
    const [left, right] = [...pieces].sort((a, b) => a.x - b.x);
    expect(left).toMatchObject({ x: 10, y: 10, h: 40 });
    expect(right).toMatchObject({ y: 16, h: 40 });
    expect(Math.abs(left!.w - 40)).toBeLessThanOrEqual(1);
    expect(Math.abs(right!.x - 50)).toBeLessThanOrEqual(1);
  });

  it('leaves a note without a seam alone', () => {
    const s = scene(100, 60);
    s.paint(10, 10, 80, 40, 200, 1);
    scribble(s.paint);
    const box = boxOf(10, 10, 80, 40);
    expect(cutAtSeam(box, s.lum, s.mask, 40)).toEqual([box]);
  });
});
