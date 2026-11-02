import { describe, expect, it } from 'vitest';
import { decodeBoxes, labelCores } from './decode';
import { idsFromBoxes, seamRadiusFor, threeClassMask } from './mask';

function classesOf(notes: { x: number; y: number; w: number; h: number }[], w: number, h: number) {
  const ids = idsFromBoxes(notes, w, h);
  return threeClassMask(ids, w, h, (id) => seamRadiusFor(notes[id - 1]!.w, notes[id - 1]!.h));
}

describe('labelCores', () => {
  it('labels each 4-connected core blob once', () => {
    const notes = [
      { x: 2, y: 2, w: 20, h: 20 },
      { x: 22, y: 2, w: 20, h: 20 },
    ];
    const { count } = labelCores(classesOf(notes, 50, 30), 50, 30);
    expect(count).toBe(2);
  });
});

describe('decodeBoxes', () => {
  const flush = [
    { x: 10, y: 10, w: 40, h: 40 },
    { x: 50, y: 10, w: 40, h: 40 },
    { x: 10, y: 50, w: 40, h: 40 },
    { x: 50, y: 50, w: 40, h: 40 },
  ];

  for (const mode of ['core', 'grow'] as const) {
    it(`splits a flush 2x2 block into its four notes (${mode})`, () => {
      const boxes = decodeBoxes(classesOf(flush, 100, 100), 100, 100, { mode, minCorePixels: 10 });
      expect(boxes).toHaveLength(4);
      for (const note of flush) {
        const hit = boxes.find((b) => Math.abs(b.x - note.x) <= 1 && Math.abs(b.y - note.y) <= 1);
        expect(hit, `note at ${note.x},${note.y}`).toBeDefined();
        expect(Math.abs(hit!.w - note.w)).toBeLessThanOrEqual(2);
        expect(Math.abs(hit!.h - note.h)).toBeLessThanOrEqual(2);
      }
    });
  }

  it('drops a core too small to be a note', () => {
    const classes = new Uint8Array(100);
    classes[55] = 1;
    expect(decodeBoxes(classes, 10, 10, { mode: 'core', minCorePixels: 4 })).toHaveLength(0);
  });

  it("drops a box far smaller than the wall's median note, when asked", () => {
    const notes = [
      { x: 0, y: 0, w: 30, h: 30 },
      { x: 40, y: 0, w: 30, h: 30 },
      { x: 80, y: 0, w: 30, h: 30 },
      { x: 120, y: 0, w: 12, h: 12 },
    ];
    const classes = classesOf(notes, 140, 40);
    const all = decodeBoxes(classes, 140, 40, { mode: 'core', minCorePixels: 4 });
    const kept = decodeBoxes(classes, 140, 40, {
      mode: 'core',
      minCorePixels: 4,
      minAreaOfMedian: 0.3,
    });
    expect(all).toHaveLength(4);
    expect(kept).toHaveLength(3);
    expect(kept.every((b) => b.x < 120)).toBe(true);
  });

  it('grows a core only into seam, never across background', () => {
    const w = 60;
    const h = 30;
    const classes = classesOf([{ x: 5, y: 5, w: 20, h: 20 }], w, h);
    // A seam-coloured strip far from the note must not be claimed by it.
    for (let y = 5; y < 25; y += 1) classes[y * w + 50] = 2;
    const [box] = decodeBoxes(classes, w, h, { mode: 'grow', minCorePixels: 10 });
    expect(box!.x + box!.w).toBeLessThanOrEqual(26);
  });
});
