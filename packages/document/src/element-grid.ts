// The element grid (docs/specs/008-canvas/canvas-performance.md "Questions about neighbours ask a
// spatial index"): which boxed elements sit near a rect, so a per-frame question about each element's
// neighbours (an arrow's route-behind holes) costs the neighbourhood, not the board.
//
// A uniform grid of ELEMENT_GRID_CELL canvas px cells over each boxed element's unrotated box, the
// rect the route-behind test uses. An element spanning more than ELEMENT_GRID_MAX_CELLS cells sits on
// an oversize list every query returns. A query returns candidates once each, in paint order; callers
// still run their exact test.

import { isBoxed, type Element } from './index';
import type { Rect } from './geometry-primitives';

// docs/specs/008-canvas/blueprints/DEFAULTS.md D63, D64.
export const ELEMENT_GRID_CELL = 256;
export const ELEMENT_GRID_MAX_CELLS = 64;

type Entry = { el: Element; order: number; cells: readonly string[] | null };

export type ElementGrid = {
  readonly entries: ReadonlyMap<string, Entry>;
  readonly buckets: ReadonlyMap<string, readonly string[]>;
  readonly oversize: ReadonlySet<string>;
  readonly skipped: ReadonlySet<string>;
};

const finiteRect = (r: Rect) =>
  Number.isFinite(r.x) &&
  Number.isFinite(r.y) &&
  Number.isFinite(r.width) &&
  Number.isFinite(r.height) &&
  r.width >= 0 &&
  r.height >= 0;

function cellSpan(r: Rect): { x0: number; x1: number; y0: number; y1: number } {
  return {
    x0: Math.floor(r.x / ELEMENT_GRID_CELL),
    x1: Math.floor((r.x + r.width) / ELEMENT_GRID_CELL),
    y0: Math.floor(r.y / ELEMENT_GRID_CELL),
    y1: Math.floor((r.y + r.height) / ELEMENT_GRID_CELL),
  };
}

// The cells an element covers; null when it is too large to bucket (the oversize list), undefined
// when its box is unusable.
function cellsOf(el: Element): string[] | null | undefined {
  if (!isBoxed(el)) return undefined;
  const r = { x: el.x, y: el.y, width: el.width, height: el.height };
  if (!finiteRect(r)) return undefined;
  const { x0, x1, y0, y1 } = cellSpan(r);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > ELEMENT_GRID_MAX_CELLS) return null;
  const out: string[] = [];
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) out.push(`${cx},${cy}`);
  return out;
}

const EMPTY: ElementGrid = {
  entries: new Map(),
  buckets: new Map(),
  oversize: new Set(),
  skipped: new Set(),
};

export function buildElementGrid(elements: readonly Element[]): ElementGrid {
  return updateElementGrid(EMPTY, elements);
}

// The grid for `next`, re-bucketing only the elements added, changed (by identity) or removed since
// `grid`. Touched buckets are copied, so `grid` stays valid.
export function updateElementGrid(grid: ElementGrid, next: readonly Element[]): ElementGrid {
  const entries = new Map<string, Entry>();
  const buckets = new Map(grid.buckets);
  const oversize = new Set(grid.oversize);
  const skipped = new Set<string>();
  const copied = new Set<string>();
  // This update's own copy of a bucket, made on first touch (so `grid` keeps its arrays).
  const bucket = (key: string): string[] => {
    const current = buckets.get(key);
    if (copied.has(key) && current) return current as string[];
    const own = [...(current ?? [])];
    buckets.set(key, own);
    copied.add(key);
    return own;
  };
  const unplace = (id: string, cells: readonly string[] | null) => {
    if (cells === null) {
      oversize.delete(id);
      return;
    }
    for (const key of cells) {
      const own = bucket(key);
      const at = own.indexOf(id);
      if (at >= 0) own.splice(at, 1);
      if (own.length === 0) buckets.delete(key);
    }
  };

  next.forEach((el, order) => {
    const prev = grid.entries.get(el.id);
    if (prev && prev.el === el) {
      entries.set(el.id, { el, order, cells: prev.cells });
      return;
    }
    if (prev) unplace(el.id, prev.cells);
    const cells = cellsOf(el);
    if (cells === undefined) {
      if (isBoxed(el)) {
        skipped.add(el.id);
        if (!grid.skipped.has(el.id)) console.debug('[element-grid] skipped element', el.id);
      }
      return;
    }
    entries.set(el.id, { el, order, cells });
    if (cells === null) oversize.add(el.id);
    else for (const key of cells) bucket(key).push(el.id);
  });
  for (const [id, prev] of grid.entries) if (!entries.has(id)) unplace(id, prev.cells);
  return { entries, buckets, oversize, skipped };
}

let warnedBadRect = false;

export function queryElementGrid(grid: ElementGrid, rect: Rect): Element[] {
  const found = new Set<string>(grid.oversize);
  if (finiteRect(rect)) {
    const { x0, x1, y0, y1 } = cellSpan(rect);
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++)
        for (const id of grid.buckets.get(`${cx},${cy}`) ?? []) found.add(id);
  } else if (!warnedBadRect) {
    warnedBadRect = true;
    console.debug('[element-grid] bad query rect', rect);
  }
  const hits: Entry[] = [];
  for (const id of found) {
    const entry = grid.entries.get(id);
    if (entry) hits.push(entry);
  }
  return hits.sort((a, b) => a.order - b.order).map((e) => e.el);
}

// One grid per element list, for a render that asks about many arrows over the same board (an export,
// a thumbnail, the Map): built on first ask, reused while the list is the same array.
const gridCache = new WeakMap<readonly Element[], ElementGrid>();
export function elementGridFor(elements: readonly Element[]): ElementGrid {
  let grid = gridCache.get(elements);
  if (!grid) {
    grid = buildElementGrid(elements);
    gridCache.set(elements, grid);
  }
  return grid;
}

// The grid of a board that changes over time (the canvas's drawn elements): each new list is
// re-bucketed from the last grid, only for what changed; the same list gives back the same grid.
export function createElementGridTracker(): {
  gridFor: (elements: readonly Element[]) => ElementGrid;
} {
  let last: { elements: readonly Element[]; grid: ElementGrid } | null = null;
  return {
    gridFor(elements) {
      if (last?.elements !== elements) {
        const grid = last ? updateElementGrid(last.grid, elements) : buildElementGrid(elements);
        last = { elements, grid };
      }
      return last.grid;
    },
  };
}
