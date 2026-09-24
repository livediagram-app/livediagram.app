import { describe, expect, it } from 'vitest';
import { splitAtNecks } from './necks';
import { splitOversized } from './split';
import type { Box, PaperMask } from './boxes';

// Taking a blob apart at its NECKS: notes of one colour that touch only at a
// corner or along a sliver are joined by paper much thinner than a note, and
// an erosion a fraction of a note deep parts them there.

function canvas(width: number, height: number) {
  const mask: PaperMask = { width, height, classes: new Uint8Array(width * height) };
  const paint = (x: number, y: number, w: number, h: number, c = 1) => {
    for (let yy = y; yy < y + h; yy += 1)
      for (let xx = x; xx < x + w; xx += 1) mask.classes[yy * width + xx] = c;
  };
  const boxAround = (): Box => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -1;
    let maxY = -1;
    let pixels = 0;
    for (let y = 0; y < height; y += 1)
      for (let x = 0; x < width; x += 1) {
        if (mask.classes[y * width + x] !== 1) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        pixels += 1;
      }
    return { classId: 1, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, pixels };
  };
  return { mask, paint, boxAround };
}

describe('splitAtNecks', () => {
  it('parts two notes that touch at a corner', () => {
    const c = canvas(120, 120);
    c.paint(10, 10, 40, 40);
    c.paint(47, 47, 40, 40);
    const pieces = splitAtNecks(c.boxAround(), c.mask, 40);
    expect(pieces).toHaveLength(2);
    const [a, b] = [...pieces].sort((p, q) => p.x - q.x);
    expect(a).toMatchObject({ x: 10, y: 10 });
    expect(b!.x + b!.w).toBe(87);
    expect(b!.y + b!.h).toBe(87);
    // Every pixel of the blob goes to one note or the other.
    expect(a!.pixels + b!.pixels).toBe(c.boxAround().pixels);
  });

  it('parts two notes joined by a sliver of paper', () => {
    const c = canvas(140, 60);
    c.paint(10, 10, 40, 40);
    c.paint(50, 26, 10, 5);
    c.paint(60, 10, 40, 40);
    const pieces = splitAtNecks(c.boxAround(), c.mask, 40);
    expect(pieces).toHaveLength(2);
    const [a, b] = [...pieces].sort((p, q) => p.x - q.x);
    expect(a!.x).toBe(10);
    expect(b!.x + b!.w).toBe(100);
  });

  it('leaves two flush notes to the splitter: there is no neck between them', () => {
    const c = canvas(120, 60);
    c.paint(10, 10, 80, 40);
    const box = c.boxAround();
    expect(splitAtNecks(box, c.mask, 40)).toEqual([box]);
  });

  it('leaves one note whole, however ragged its edge', () => {
    const c = canvas(80, 80);
    c.paint(10, 10, 40, 40);
    // A notch a quarter of the note deep, and a tab sticking out.
    for (let y = 26; y < 32; y += 1)
      for (let x = 10; x < 20; x += 1) c.mask.classes[y * 80 + x] = 0;
    c.paint(50, 20, 6, 8);
    const box = c.boxAround();
    expect(splitAtNecks(box, c.mask, 40)).toEqual([box]);
  });

  it('trims a fringe of paper colour trailing off a note', () => {
    // A line of pixels a JPEG edge painted this colour along a neighbour of
    // another kind: one pixel wide, running a note's length off the corner.
    const c = canvas(100, 120);
    c.paint(10, 10, 40, 40);
    c.paint(49, 50, 1, 40);
    const pieces = splitAtNecks(c.boxAround(), c.mask, 40);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toMatchObject({ x: 10, y: 10, w: 40 });
    expect(pieces[0]!.h).toBeLessThan(56);
  });

  it('follows no fringe down the side of a neighbour of another colour', () => {
    // The JPEG paints the edge of a neighbour of another kind in this note's
    // colour: a line one pixel wide, running from the note's corner down the
    // neighbour's side. The regrowth reaches to 56 (h 46), but past the
    // note's own body it follows no paper that touches the neighbour.
    const c = canvas(120, 120);
    c.paint(10, 10, 40, 40);
    c.paint(50, 50, 40, 40, 2);
    c.paint(49, 50, 1, 16);
    const pieces = splitAtNecks(c.boxAround(), c.mask, 40);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toMatchObject({ x: 10, y: 10, w: 40 });
    expect(pieces[0]!.h).toBeLessThanOrEqual(44);
  });

  it('only reads paper of the box’s own colour', () => {
    const c = canvas(120, 60);
    c.paint(10, 10, 40, 40);
    c.paint(50, 10, 40, 40, 2);
    const box = { ...c.boxAround() };
    expect(splitAtNecks(box, c.mask, 40)).toEqual([box]);
  });
});

describe('splitOversized at necks', () => {
  it('parts two notes lapped at a corner, too short for the length rule', () => {
    // 70x70 together: 1.75 notes each way, under the splitter's 1.8.
    const c = canvas(120, 120);
    c.paint(10, 10, 40, 40);
    c.paint(40, 40, 40, 40);
    const pieces = splitOversized(c.boxAround(), 40, c.mask);
    expect(pieces).toHaveLength(2);
    for (const p of pieces) expect(Math.max(p.w, p.h)).toBeLessThanOrEqual(46);
  });

  it('takes the parts only when every one is a note', () => {
    // A bar of two flush notes, and a third note lapped on at a corner: the
    // neck parts the bar from the note, but the bar is two notes long, so the
    // parts are not notes and the whole blob goes to the even grid instead
    // (measured on real walls, where such parts are groups the necks happened
    // to fall around, the grid over the whole does better).
    const c = canvas(160, 120);
    c.paint(10, 10, 80, 40);
    c.paint(80, 40, 40, 40);
    const pieces = splitOversized(c.boxAround(), 40, c.mask);
    expect(pieces.map((p) => p.x)).toEqual([10, 47, 83]);
  });
});
