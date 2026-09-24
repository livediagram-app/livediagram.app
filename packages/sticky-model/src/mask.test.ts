import { describe, expect, it } from 'vitest';
import {
  AMBIGUOUS_ID,
  CLASS,
  idsFromBoxes,
  noteFromCore,
  seamRadiusFor,
  threeClassMask,
} from './mask';

function idsWith(width: number, height: number, rects: [number, number, number, number][]) {
  const ids = new Int32Array(width * height);
  rects.forEach(([x0, y0, w, h], i) => {
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) ids[y * width + x] = i + 1;
    }
  });
  return ids;
}

const at = (mask: Uint8Array, width: number, x: number, y: number) => mask[y * width + x];

describe('threeClassMask', () => {
  it('rings a lone note with seam and keeps its inside as core', () => {
    const ids = idsWith(20, 20, [[5, 5, 10, 10]]);
    const mask = threeClassMask(ids, 20, 20, () => 2);
    expect(at(mask, 20, 0, 0)).toBe(CLASS.background);
    expect(at(mask, 20, 5, 5)).toBe(CLASS.seam);
    expect(at(mask, 20, 6, 9)).toBe(CLASS.seam);
    expect(at(mask, 20, 7, 7)).toBe(CLASS.core);
    expect(at(mask, 20, 12, 12)).toBe(CLASS.core);
    expect(at(mask, 20, 13, 12)).toBe(CLASS.seam);
    const cores = [...mask].filter((c) => c === CLASS.core).length;
    expect(cores).toBe(36);
  });

  it('separates the cores of two flush notes by a seam twice the radius wide', () => {
    const ids = idsWith(30, 12, [
      [0, 0, 15, 12],
      [15, 0, 15, 12],
    ]);
    const mask = threeClassMask(ids, 30, 12, () => 3);
    const row = [...mask.subarray(6 * 30, 7 * 30)];
    expect(row.slice(12, 18).every((c) => c === CLASS.seam)).toBe(true);
    expect(row[11]).toBe(CLASS.core);
    expect(row[18]).toBe(CLASS.core);
  });

  it('keeps core up to the frame edge, where a note is cut by the photo', () => {
    const ids = idsWith(10, 10, [[0, 0, 10, 10]]);
    const mask = threeClassMask(ids, 10, 10, () => 2);
    expect([...mask].every((c) => c === CLASS.core)).toBe(true);
  });

  it('uses each note its own radius', () => {
    const ids = idsWith(40, 20, [
      [0, 0, 20, 20],
      [20, 0, 20, 20],
    ]);
    const mask = threeClassMask(ids, 40, 20, (id) => (id === 1 ? 2 : 5));
    const row = [...mask.subarray(10 * 40, 11 * 40)];
    expect(row[17]).toBe(CLASS.core);
    expect(row[18]).toBe(CLASS.seam);
    expect(row[24]).toBe(CLASS.seam);
    expect(row[25]).toBe(CLASS.core);
  });

  it('calls an ambiguous pixel seam, never core', () => {
    const ids = new Int32Array(9).fill(AMBIGUOUS_ID);
    const mask = threeClassMask(ids, 3, 3, () => 1);
    expect([...mask].every((c) => c === CLASS.seam)).toBe(true);
  });
});

describe('idsFromBoxes', () => {
  it('paints each box its own id and marks overlaps ambiguous', () => {
    const ids = idsFromBoxes(
      [
        { x: 0, y: 0, w: 4, h: 4 },
        { x: 3, y: 0, w: 4, h: 4 },
      ],
      8,
      4,
    );
    expect(ids[0]).toBe(1);
    expect(ids[3]).toBe(AMBIGUOUS_ID);
    expect(ids[5]).toBe(2);
    expect(ids[7]).toBe(0);
  });

  it('clips boxes that run off the frame', () => {
    const ids = idsFromBoxes([{ x: -2, y: -2, w: 4, h: 4 }], 4, 4);
    expect(ids[0]).toBe(1);
    expect(ids[1]).toBe(1);
    expect(ids[2]).toBe(0);
  });
});

describe('seamRadiusFor and noteFromCore', () => {
  it('never lets the seam fall under two pixels', () => {
    expect(seamRadiusFor(12, 30)).toBe(2);
  });

  it('grows with the note', () => {
    expect(seamRadiusFor(80, 100)).toBe(8);
  });

  it('recovers the note from its core, for small and large notes', () => {
    for (const side of [14, 20, 36, 60, 100]) {
      const r = seamRadiusFor(side, side);
      const core = { x: 10 + r, y: 20 + r, w: side - 2 * r, h: side - 2 * r };
      const note = noteFromCore(core);
      expect(Math.abs(note.w - side)).toBeLessThanOrEqual(2);
      expect(Math.abs(note.x - 10)).toBeLessThanOrEqual(1);
    }
  });
});
