import { describe, expect, it } from 'vitest';
import { rectIndex } from './page-tidy-index';

// docs/specs/007-editor/pages-mode.md "Tidy": the grid Tidy Up's pair checks look up neighbours in.
const r = (x: number, y: number, width = 10, height = 10) => ({ x, y, width, height });

describe('rectIndex', () => {
  it('answers the rects near a query, ascending, and leaves out the far and the null', () => {
    const near = rectIndex([r(500, 500), r(0, 0), null, r(12, 0), r(-300, -300)]);
    expect(near.query(r(5, 5))).toEqual([1, 3]);
    expect(near.query(r(-300, -300, 1, 1))).toEqual([4]);
    // Grown by a pad, it reaches further.
    expect(near.query(r(30, 0, 1, 1))).toEqual([]);
    expect(near.query(r(30, 0, 1, 1), 20)).toEqual([1, 3]);
  });

  it('follows a rect that moves, wide or not', () => {
    // Cells follow the rects' mean side, so twenty small ones (at 1500, out of the way) make the 2000 one wide.
    const small = Array.from({ length: 20 }, (_, i) => r(1500 + i * 12, 1500));
    const near = rectIndex([r(0, 0), r(100, 100), r(0, 0, 2000, 2000), ...small]);
    // The page-wide one is answered everywhere.
    expect(near.query(r(-500, -500, 1, 1))).toEqual([2]);
    near.move(0, r(100, 100));
    expect(near.query(r(0, 0, 1, 1))).toEqual([2]);
    expect(near.query(r(105, 105, 1, 1))).toEqual([0, 1, 2]);
    near.move(2, r(900, 900));
    expect(near.query(r(-500, -500, 1, 1))).toEqual([]);
    expect(near.query(r(905, 905, 1, 1))).toEqual([2]);
    near.move(1, r(0, 0, 3000, 3000));
    expect(near.query(r(-1, -1, 1, 1))).toEqual([1]);
  });

  it('answers everything to a query over most of the grid, and copes with no rects or a flipped one', () => {
    const near = rectIndex([r(0, 0), r(400, 400), r(10, 10, -5, -5)]);
    expect(near.query(r(-1000, -1000, 5000, 5000))).toEqual([0, 1, 2]);
    expect(near.query(r(6, 6, 1, 1))).toEqual([0, 2]);
    const none = rectIndex([null]);
    expect(none.query(r(0, 0))).toEqual([]);
    none.move(0, r(0, 0));
    expect(none.query(r(0, 0))).toEqual([0]);
  });
});
