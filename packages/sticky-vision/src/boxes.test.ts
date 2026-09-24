import { describe, expect, it } from 'vitest';
import { mergeFragments, type Box } from './boxes';

// Putting a note back together from the pieces handwriting cut it into, and
// never gluing two notes together while doing it.

const box = (x: number, y: number, w: number, h: number, fill = 0.95): Box => ({
  classId: 1,
  x,
  y,
  w,
  h,
  pixels: Math.round(w * h * fill),
});

describe('mergeFragments', () => {
  it('rejoins the halves of one note a line of handwriting cut apart', () => {
    // A 50px note cut across by a 10px band of shadow: two 50x20 halves.
    const out = mergeFragments([box(0, 0, 50, 20), box(0, 30, 50, 20)], 50);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ x: 0, y: 0, w: 50, h: 50 });
  });

  it('keeps two narrow whole notes side by side as two, however close', () => {
    // Two actors on a wall of 50px notes: each 32x50 and whole, 3px apart.
    // Their union is a solid 67x50 square that a fill test alone accepts.
    const out = mergeFragments([box(0, 0, 32, 50), box(35, 0, 32, 50)], 50);
    expect(out).toHaveLength(2);
  });

  it('keeps two whole notes stacked a pen stroke apart as two', () => {
    const out = mergeFragments([box(0, 0, 50, 48), box(0, 51, 50, 48)], 50);
    expect(out).toHaveLength(2);
  });

  it('still folds a sliver of a note into the note it came off', () => {
    const out = mergeFragments([box(0, 0, 50, 40), box(0, 43, 50, 7)], 50);
    expect(out).toHaveLength(1);
  });
});
