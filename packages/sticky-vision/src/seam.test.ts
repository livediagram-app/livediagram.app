import { describe, expect, it } from 'vitest';
import { cutAtSeam, findSeam, luminanceOf, type Luminance } from './seam';
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

  it('finds the step between two flush notes of different brightness', () => {
    // Two notes butted together, one lit a little less than the other: no
    // shadow line between them, only the paper's level changing.
    const s = scene(100, 60);
    s.paint(10, 10, 40, 40, 185, 1);
    s.paint(50, 10, 40, 40, 205, 1);
    scribble(s.paint);
    const seam = findSeam(s.lum, boxOf(10, 10, 80, 40), 40);
    expect(seam).not.toBeNull();
    expect(seam!.vertical).toBe(true);
    expect(Math.abs(seam!.at - 49.5)).toBeLessThanOrEqual(3);
  });

  it('trusts no step across a box that one note could nearly fill', () => {
    // 1.4 notes long: a step there is as likely a line of writing's edge or
    // the light falling off across one note as two notes.
    const s = scene(100, 60);
    s.paint(10, 10, 28, 40, 185, 1);
    s.paint(38, 10, 28, 40, 205, 1);
    expect(findSeam(s.lum, boxOf(10, 10, 56, 40), 40)).toBeNull();
  });

  it('finds none nearer the edge than a note can be thin', () => {
    const s = scene(100, 60);
    s.paint(10, 10, 80, 40, 200, 1);
    s.paint(20, 10, 2, 40, 165);
    expect(findSeam(s.lum, boxOf(10, 10, 80, 40), 40)).toBeNull();
  });
});

// Two notes of one kind from different pads: the same brightness, the same
// class to the colour mask, but plainly different paper.
function colourScene(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  const mask: PaperMask = { width, height, classes: new Uint8Array(width * height) };
  const paint = (x: number, y: number, w: number, h: number, rgb: number[], c?: number) => {
    for (let yy = y; yy < y + h; yy += 1)
      for (let xx = x; xx < x + w; xx += 1) {
        const i = (yy * width + xx) * 4;
        data.set([rgb[0]!, rgb[1]!, rgb[2]!, 255], i);
        if (c !== undefined) mask.classes[yy * width + xx] = c;
      }
  };
  paint(0, 0, width, height, [150, 150, 150]);
  return { image: { width, height, data }, mask, paint };
}

const ORANGE_YELLOW = [212, 168, 20];
const LEMON = [186, 180, 16];
const BLUE_INK = [40, 50, 120];

describe('findSeam between two pads', () => {
  it('finds where the paper changes colour, though not brightness', () => {
    const s = colourScene(100, 60);
    // 1.2 notes long: too short for a shadow, long enough for two pads.
    s.paint(10, 10, 18, 30, ORANGE_YELLOW, 1);
    s.paint(28, 10, 18, 30, LEMON, 1);
    const seam = findSeam(luminanceOf(s.image), boxOf(10, 10, 36, 30), 30, s.mask);
    expect(seam).toMatchObject({ vertical: true, by: 'hue' });
    expect(Math.abs(seam!.at - 27.5)).toBeLessThanOrEqual(1);
  });

  it('finds none in one note written on in blue', () => {
    const s = colourScene(100, 60);
    // 1.47 notes long: long enough for a colour seam, not for a step.
    s.paint(10, 10, 44, 30, ORANGE_YELLOW, 1);
    s.paint(14, 14, 12, 3, BLUE_INK);
    s.paint(16, 20, 3, 10, BLUE_INK);
    s.paint(22, 24, 8, 2, BLUE_INK);
    s.paint(40, 16, 3, 16, BLUE_INK);
    expect(findSeam(luminanceOf(s.image), boxOf(10, 10, 44, 30), 30)).toBeNull();
  });

  it('finds none across a box no longer than one note', () => {
    const s = colourScene(100, 60);
    // Each side would be half a note: two pads' notes are not that thin.
    s.paint(10, 10, 15, 30, ORANGE_YELLOW, 1);
    s.paint(25, 10, 15, 30, LEMON, 1);
    expect(findSeam(luminanceOf(s.image), boxOf(10, 10, 30, 30), 30)).toBeNull();
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

  it('cuts a column of small notes at their own scale', () => {
    // Two small notes stacked flush, each 20 px square, on a wall whose
    // note is 36 px: the column is not 1.3 wall notes long, but it is two
    // notes of its own width.
    const s = scene(60, 70);
    s.paint(20, 10, 20, 40, 200, 1);
    s.paint(20, 29, 20, 2, 165);
    const pieces = cutAtSeam(boxOf(20, 10, 20, 40), s.lum, s.mask, 36);
    expect(pieces).toHaveLength(2);
    const [top, bottom] = [...pieces].sort((a, b) => a.y - b.y);
    expect(Math.abs(top!.h - 20)).toBeLessThanOrEqual(1);
    expect(Math.abs(bottom!.y - 30)).toBeLessThanOrEqual(1);
  });

  it('leaves a note without a seam alone', () => {
    const s = scene(100, 60);
    s.paint(10, 10, 80, 40, 200, 1);
    scribble(s.paint);
    const box = boxOf(10, 10, 80, 40);
    expect(cutAtSeam(box, s.lum, s.mask, 40)).toEqual([box]);
  });
});
