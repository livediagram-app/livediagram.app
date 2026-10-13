// A bucket grid over the boxes Tidy Up's router must keep clear of (auto-layout-route.ts), so a
// leg is tested against the boxes near it rather than every box on the tab. Each box sits in every
// cell its padded bounds touch; a query returns each box at most once, in no particular order.

import type { Rect } from './geometry-primitives';

// Cell edge, in canvas px: about one box plus its gap, so a leg spans a few cells, not hundreds.
export const ROUTE_GRID_CELL = 160;

export type RectGrid = {
  /** Every box whose bounds grown by `pad` may meet the box from (x0, y0) to (x1, y1). */
  near: (x0: number, y0: number, x1: number, y1: number) => Rect[];
};

export function rectGrid(rects: Rect[], pad: number): RectGrid {
  const cells = new Map<string, number[]>();
  const cell = (v: number) => Math.floor(v / ROUTE_GRID_CELL);
  rects.forEach((r, i) => {
    for (let cx = cell(r.x - pad); cx <= cell(r.x + r.width + pad); cx++)
      for (let cy = cell(r.y - pad); cy <= cell(r.y + r.height + pad); cy++) {
        const key = `${cx},${cy}`;
        const list = cells.get(key);
        if (list) list.push(i);
        else cells.set(key, [i]);
      }
  });
  // A stamp per box, so a box filed under several cells is returned once per query.
  const seen = new Uint32Array(rects.length);
  let stamp = 0;
  return {
    near(x0, y0, x1, y1) {
      stamp++;
      const out: Rect[] = [];
      for (let cx = cell(x0); cx <= cell(x1); cx++)
        for (let cy = cell(y0); cy <= cell(y1); cy++)
          for (const i of cells.get(`${cx},${cy}`) ?? []) {
            if (seen[i] === stamp) continue;
            seen[i] = stamp;
            out.push(rects[i]!);
          }
      return out;
    },
  };
}
