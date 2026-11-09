// A uniform grid over rects by id (each product's docs/specs/008-canvas/canvas-performance.md "Questions about
// neighbours ask a spatial index"): which of many rects meet a given one, at the cost of that rect's neighbourhood.
// The drag preview buckets every arrow's route-behind rect once per board change and asks it about each moved box on
// every frame; the arrow label pass buckets the boxes once and the labels as it places them, and asks it about each
// candidate place. So the work is linear in what is asked about, never all × all.
//
// The same cell size and oversize rule as each product's element grid (DEFAULTS.md D63, D64): a rect spanning more
// than RECT_GRID_MAX_CELLS cells sits on a list every query tests. So does a rect no cell can hold (not finite, or of
// negative size), which rectsIntersect may still find meeting something: the grid is exact for every input, never a
// guess. A query no cell can hold tests every rect, and a query wider than the occupied cells walks those instead.
// Callers get exactly the ids whose rect rectsIntersect the query.

import { rectsIntersect, type Rect } from './geometry-primitives';

// Each product's DEFAULTS.md D63 and D64, the element grid's numbers.
export const RECT_GRID_CELL = 256;
export const RECT_GRID_MAX_CELLS = 64;

export type RectGrid = {
  readonly rects: ReadonlyMap<string, Rect>;
  readonly buckets: ReadonlyMap<string, readonly string[]>;
  // Tested by every query: too large to bucket, or no cell can hold them.
  readonly always: readonly string[];
};

type MutableRectGrid = {
  rects: Map<string, Rect>;
  buckets: Map<string, string[]>;
  always: string[];
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
    x0: Math.floor(r.x / RECT_GRID_CELL),
    x1: Math.floor((r.x + r.width) / RECT_GRID_CELL),
    y0: Math.floor(r.y / RECT_GRID_CELL),
    y1: Math.floor((r.y + r.height) / RECT_GRID_CELL),
  };
}

export function createRectGrid(): RectGrid {
  return { rects: new Map(), buckets: new Map(), always: [] };
}

// Adds `rect` under `id`. An id already in the grid keeps its first rect: ids are unique by contract.
export function addToRectGrid(grid: RectGrid, id: string, rect: Rect): void {
  const g = grid as MutableRectGrid;
  if (g.rects.has(id)) return;
  g.rects.set(id, rect);
  if (!usable(rect)) {
    g.always.push(id);
    return;
  }
  const { x0, x1, y0, y1 } = span(rect);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > RECT_GRID_MAX_CELLS) {
    g.always.push(id);
    return;
  }
  for (let cx = x0; cx <= x1; cx++)
    for (let cy = y0; cy <= y1; cy++) {
      const key = `${cx},${cy}`;
      const bucket = g.buckets.get(key);
      if (bucket) bucket.push(id);
      else g.buckets.set(key, [id]);
    }
}

export function buildRectGrid(rects: ReadonlyMap<string, Rect>): RectGrid {
  const grid = createRectGrid();
  for (const [id, r] of rects) addToRectGrid(grid, id, r);
  return grid;
}

// Calls `hit` once for each id whose rect meets `query` that `seen` does not hold yet, adding it to `seen`. The order
// follows the grid, not the ids' insertion: a caller that needs an order sorts what it gets.
export function eachRectMeeting(
  grid: RectGrid,
  query: Rect,
  seen: Set<string>,
  hit: (id: string) => void,
): void {
  const test = (id: string) => {
    if (seen.has(id)) return;
    if (!rectsIntersect(grid.rects.get(id)!, query)) return;
    seen.add(id);
    hit(id);
  };
  if (!usable(query)) {
    for (const id of grid.rects.keys()) test(id);
    return;
  }
  for (const id of grid.always) test(id);
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

// Whether any rect but `except`'s meets `query`: the same answer as testing every rect, at the neighbourhood's cost.
export function anyRectMeeting(grid: RectGrid, query: Rect, except?: string): boolean {
  const meets = (id: string) => id !== except && rectsIntersect(grid.rects.get(id)!, query);
  if (!usable(query)) {
    for (const id of grid.rects.keys()) if (meets(id)) return true;
    return false;
  }
  for (const id of grid.always) if (meets(id)) return true;
  const { x0, x1, y0, y1 } = span(query);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > grid.buckets.size) {
    for (const [key, ids] of grid.buckets) {
      const comma = key.indexOf(',');
      const cx = Number(key.slice(0, comma));
      const cy = Number(key.slice(comma + 1));
      if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1)
        for (const id of ids) if (meets(id)) return true;
    }
    return false;
  }
  for (let cx = x0; cx <= x1; cx++)
    for (let cy = y0; cy <= y1; cy++)
      for (const id of grid.buckets.get(`${cx},${cy}`) ?? []) if (meets(id)) return true;
  return false;
}
