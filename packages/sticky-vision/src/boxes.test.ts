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

describe('fitBoxes, a narrow note', () => {
  // A wall of 40px notes; a note a note long but thinner than the others:
  // an actor, a note half under its neighbour, a note seen at a slant.
  function wallWith(paint: (x: number, y: number) => boolean, w: number, h: number) {
    const width = 100;
    const height = 100;
    const classes = new Uint8Array(width * height);
    let pixels = 0;
    for (let y = 10; y < 10 + h; y += 1)
      for (let x = 10; x < 10 + w; x += 1)
        if (paint(x - 10, y - 10)) {
          classes[y * width + x] = 1;
          pixels += 1;
        }
    const component = { classId: 1, minX: 10, minY: 10, maxX: 9 + w, maxY: 9 + h, pixels };
    return { component, mask: { width, height, classes } };
  }
  const fit = (w: number, h: number, paint: (x: number, y: number) => boolean = () => true) => {
    const { component, mask } = wallWith(paint, w, h);
    const reasons: string[] = [];
    const out = fitBoxes([component], {
      imageSize: 1000,
      noteSize: 40,
      mask,
      seams: mask,
      onDrop: (_b, why) => reasons.push(why),
    });
    return { out, reasons };
  };

  it('keeps a note a full note long, though thinner than the floor', () => {
    expect(fit(22, 40).out).toHaveLength(1);
  });

  it('keeps it without a mask to look at, too', () => {
    const c = { classId: 1, minX: 0, minY: 0, maxX: 21, maxY: 39, pixels: 22 * 40 };
    expect(fitBoxes([c], { imageSize: 1000, noteSize: 40 })).toHaveLength(1);
  });

  it('still drops a strip thinner than half a note', () => {
    const { out, reasons } = fit(18, 40);
    expect(out).toHaveLength(0);
    expect(reasons).toContain('size-floor');
  });

  it('still drops a thin box shorter than a note', () => {
    expect(fit(22, 30).out).toHaveLength(0);
  });

  it('drops two small squares stacked, with a line of wall between them', () => {
    expect(fit(20, 46, (_x, y) => y !== 22 && y !== 23).out).toHaveLength(0);
  });

  it('cuts a column of two narrow notes end to end into the two', () => {
    const { out } = fit(24, 88);
    expect(out).toHaveLength(2);
    for (const b of out) {
      expect(b.w).toBe(24);
      expect(b.h).toBeGreaterThanOrEqual(40);
      expect(b.h).toBeLessThanOrEqual(48);
    }
  });

  it('cuts a row of three narrow notes the same way', () => {
    const width = 150;
    const classes = new Uint8Array(width * 60);
    for (let y = 10; y < 34; y += 1) for (let x = 5; x < 137; x += 1) classes[y * width + x] = 1;
    const component = { classId: 1, minX: 5, minY: 10, maxX: 136, maxY: 33, pixels: 132 * 24 };
    const mask = { width, height: 60, classes };
    const out = fitBoxes([component], { imageSize: 1000, noteSize: 40, mask, seams: mask });
    expect(out).toHaveLength(3);
  });

  it('still drops a strip of tape two notes long', () => {
    expect(fit(18, 88).out).toHaveLength(0);
  });

  it('does not make two narrow notes of four small squares in a column', () => {
    const seams = new Set([21, 22, 65, 66]);
    expect(fit(22, 88, (_x, y) => !seams.has(y)).out).toHaveLength(0);
  });
});
