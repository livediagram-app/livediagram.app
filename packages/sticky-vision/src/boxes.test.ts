import { describe, expect, it } from 'vitest';
import { fitBoxes, mergeFragments, type Box } from './boxes';

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

describe('fitBoxes, cutting at a seam', () => {
  // Two notes of one colour, tops aligned, the right one lapped over the
  // left: 70x40 together, 1.75 notes long — under the splitter's length rule,
  // and with no notch in the outline. Only the shadow of the upper note's
  // edge says where one ends.
  function lapped(seamAt = 40) {
    const width = 120;
    const height = 60;
    const classes = new Uint8Array(width * height);
    const data = new Uint8Array(width * height).fill(90);
    for (let y = 10; y < 50; y += 1)
      for (let x = 10; x < 80; x += 1) {
        classes[y * width + x] = 1;
        data[y * width + x] = x === seamAt - 1 || x === seamAt ? 170 : 205;
      }
    const component = { classId: 1, minX: 10, minY: 10, maxX: 79, maxY: 49, pixels: 70 * 40 };
    const mask = { width, height, classes };
    return { component, mask, luminance: { width, height, data } };
  }

  it('cuts two flush lapped notes apart by the shadow between them', () => {
    const { component, mask, luminance } = lapped();
    const out = fitBoxes([component], { imageSize: 120, noteSize: 40, mask, luminance });
    expect(out).toHaveLength(2);
    const [left, right] = [...out].sort((a, b) => a.x - b.x);
    expect(left!.x).toBe(10);
    expect(Math.abs(left!.w - 30.5)).toBeLessThanOrEqual(1);
    expect(right!.x + right!.w).toBe(80);
    expect(Math.abs(right!.x - 40.5)).toBeLessThanOrEqual(1);
  });

  it('trims a sliver of the note underneath off the note on top', () => {
    // The lower note shows only 26 of its 40px: too thin to be kept as a
    // note (0.7), thick enough to cut off (0.6). The upper note's box stops
    // at the seam instead of holding both.
    const { component, mask, luminance } = lapped(36);
    const out = fitBoxes([component], { imageSize: 120, noteSize: 40, mask, luminance });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ x: 36, w: 44 });
  });

  it('leaves them as one without the photograph to look at', () => {
    const { component, mask } = lapped();
    expect(fitBoxes([component], { imageSize: 120, noteSize: 40, mask })).toHaveLength(1);
  });
});

describe('fitBoxes, saying why a box is dropped', () => {
  const component = (x: number, y: number, w: number, h: number, fill = 0.95) => ({
    classId: 1,
    minX: x,
    minY: y,
    maxX: x + w - 1,
    maxY: y + h - 1,
    pixels: Math.round(w * h * fill),
  });
  const reasonsFor = (c: ReturnType<typeof component>) => {
    const reasons: string[] = [];
    fitBoxes([c], { imageSize: 1000, noteSize: 40, onDrop: (_b, why) => reasons.push(why) });
    return reasons;
  };

  it('names a speck thinner than the noise floor', () => {
    expect(reasonsFor(component(0, 0, 3, 30))).toEqual(['noise']);
  });

  it('names a box under the area floor', () => {
    expect(reasonsFor(component(0, 0, 9, 12))).toEqual(['area']);
  });

  it('names a box under the size floor', () => {
    expect(reasonsFor(component(0, 0, 20, 20))).toContain('size-floor');
  });

  it('names a box that is mostly holes', () => {
    expect(reasonsFor(component(0, 0, 40, 40, 0.3))).toContain('fill');
  });

  it('names a strip too long to be paper', () => {
    expect(reasonsFor(component(0, 0, 60, 20))).toContain('aspect');
  });

  it('names a box far bigger than the notes', () => {
    expect(reasonsFor(component(0, 0, 110, 110, 0.5))).toContain('too-big');
  });

  it('reports nothing for a note it keeps', () => {
    expect(reasonsFor(component(0, 0, 40, 40))).toEqual([]);
  });
});
