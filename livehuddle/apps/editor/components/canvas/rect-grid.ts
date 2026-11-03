// A uniform grid over rects by id (docs/specs/008-canvas/canvas-performance.md "Questions about neighbours ask a
// spatial index"): which of many rects meet a given one, at the cost of that rect's neighbourhood. The drag preview
// buckets every arrow's route-behind rect once per document change, then asks it about each moved box on every
// frame, so a frame's arrow work is linear in what moved, never arrows × moved
// (docs/specs/008-canvas/blueprints/drag-preview.md "Performance and limits").
//
// The same cell size and oversize rule as @livehuddle/document's element grid: a rect spanning more than
// ELEMENT_GRID_MAX_CELLS cells sits on an oversize list every query returns, and a query wider than the occupied
// cells walks those instead. Callers still run their exact test.

import {
  ELEMENT_GRID_CELL,
  ELEMENT_GRID_MAX_CELLS,
  rectsIntersect,
  type Rect,
} from '@livehuddle/document';

export type RectGrid = {
  readonly rects: ReadonlyMap<string, Rect>;
  readonly buckets: ReadonlyMap<string, readonly string[]>;
  readonly oversize: readonly string[];
};

const usable = (r: Rect) =>
  Number.isFinite(r.x) &&
  Number.isFinite(r.y) &&
  Number.isFinite(r.width) &&
  Number.isFinite(r.height) &&
  r.width >= 0 &&
  r.height >= 0;

function span(r: Rect) {
  return {
    x0: Math.floor(r.x / ELEMENT_GRID_CELL),
    x1: Math.floor((r.x + r.width) / ELEMENT_GRID_CELL),
    y0: Math.floor(r.y / ELEMENT_GRID_CELL),
    y1: Math.floor((r.y + r.height) / ELEMENT_GRID_CELL),
  };
}

export function buildRectGrid(rects: ReadonlyMap<string, Rect>): RectGrid {
  const buckets = new Map<string, string[]>();
  const oversize: string[] = [];
  for (const [id, r] of rects) {
    // An unusable rect meets nothing (rectsIntersect is false on NaN); it is skipped, not bucketed.
    if (!usable(r)) continue;
    const { x0, x1, y0, y1 } = span(r);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > ELEMENT_GRID_MAX_CELLS) {
      oversize.push(id);
      continue;
    }
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const key = `${cx},${cy}`;
        const bucket = buckets.get(key);
        if (bucket) bucket.push(id);
        else buckets.set(key, [id]);
      }
  }
  return { rects, buckets, oversize };
}

// Calls `hit` once for each id whose rect meets `query` that `seen` does not hold yet, adding it to `seen`.
export function eachRectMeeting(
  grid: RectGrid,
  query: Rect,
  seen: Set<string>,
  hit: (id: string) => void,
): void {
  const test = (id: string) => {
    if (seen.has(id)) return;
    const r = grid.rects.get(id);
    if (!r || !rectsIntersect(r, query)) return;
    seen.add(id);
    hit(id);
  };
  if (!usable(query)) return;
  for (const id of grid.oversize) test(id);
  const { x0, x1, y0, y1 } = span(query);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > grid.buckets.size) {
    for (const [key, ids] of grid.buckets) {
      const comma = key.indexOf(',');
      const cx = Number(key.slice(0, comma));
      const cy = Number(key.slice(comma + 1));
      if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) for (const id of ids) test(id);
    }
    return;
  }
  for (let cx = x0; cx <= x1; cx++)
    for (let cy = y0; cy <= y1; cy++)
      for (const id of grid.buckets.get(`${cx},${cy}`) ?? []) test(id);
}
