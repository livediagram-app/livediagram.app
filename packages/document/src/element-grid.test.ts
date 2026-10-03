import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape } from './shape-factory';
import { createArrow } from './factories';
import type { Element } from './index';
import {
  ELEMENT_GRID_CELL,
  ELEMENT_GRID_MAX_CELLS,
  buildElementGrid,
  createElementGridTracker,
  elementGridFor,
  queryElementGrid,
  updateElementGrid,
} from './element-grid';

// docs/specs/008-canvas/canvas-performance.md "Questions about neighbours ask a spatial index".

const box = (x: number, y: number, w = 100, h = 100) => {
  const el = createShape('square', x, y);
  return { ...el, width: w, height: h };
};
const ids = (els: Element[]) => els.map((e) => e.id);

afterEach(() => vi.restoreAllMocks());

describe('element grid', () => {
  it('finds the elements near a rect and none far from it', () => {
    const near = box(10, 10);
    const far = box(5000, 5000);
    const grid = buildElementGrid([near, far]);
    expect(ids(queryElementGrid(grid, { x: 0, y: 0, width: 50, height: 50 }))).toEqual([near.id]);
  });

  it('returns each candidate once, in paint order', () => {
    const wide = box(0, 0, ELEMENT_GRID_CELL * 3, 50);
    const a = box(20, 20);
    const grid = buildElementGrid([a, wide]);
    const hits = queryElementGrid(grid, { x: 0, y: 0, width: ELEMENT_GRID_CELL * 3, height: 60 });
    expect(ids(hits)).toEqual([a.id, wide.id]);
  });

  it('holds boxed elements only', () => {
    const arrow = createArrow(0, 0, 50, 50);
    const grid = buildElementGrid([arrow, box(0, 0)]);
    expect(queryElementGrid(grid, { x: 0, y: 0, width: 60, height: 60 })).toHaveLength(1);
  });

  it('returns a very large element to every query', () => {
    const backdrop = box(0, 0, ELEMENT_GRID_CELL * 20, ELEMENT_GRID_CELL * 20);
    expect((ELEMENT_GRID_CELL * 20) ** 2 / ELEMENT_GRID_CELL ** 2).toBeGreaterThan(
      ELEMENT_GRID_MAX_CELLS,
    );
    const grid = buildElementGrid([backdrop]);
    const far = { x: 100_000, y: 100_000, width: 10, height: 10 };
    expect(ids(queryElementGrid(grid, far))).toEqual([backdrop.id]);
  });

  it('skips an element with unusable bounds, saying so once', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const broken = { ...box(0, 0), x: Number.NaN };
    const grid = buildElementGrid([broken, box(0, 0)]);
    expect(queryElementGrid(grid, { x: 0, y: 0, width: 50, height: 50 })).toHaveLength(1);
    updateElementGrid(grid, [broken, box(0, 0)]);
    expect(debug.mock.calls.filter(([m]) => m === '[element-grid] skipped element')).toHaveLength(
      1,
    );
  });

  it('answers a bad query rect with the oversize list alone', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    const grid = buildElementGrid([box(0, 0)]);
    expect(queryElementGrid(grid, { x: Number.NaN, y: 0, width: 10, height: 10 })).toEqual([]);
  });
});

describe('updating the grid', () => {
  it('follows a moved element and leaves the previous grid as it was', () => {
    const a = box(0, 0);
    const b = box(2000, 0);
    const before = buildElementGrid([a, b]);
    const movedA = { ...a, x: 2000 };
    const after = updateElementGrid(before, [movedA, b]);
    const atOrigin = { x: 0, y: 0, width: 50, height: 50 };
    const atRight = { x: 2000, y: 0, width: 50, height: 50 };
    expect(queryElementGrid(after, atOrigin)).toEqual([]);
    expect(ids(queryElementGrid(after, atRight))).toEqual([movedA.id, b.id]);
    expect(ids(queryElementGrid(before, atOrigin))).toEqual([a.id]);
  });

  it('drops a removed element and takes in an added one', () => {
    const a = box(0, 0);
    const c = box(10, 10);
    const after = updateElementGrid(buildElementGrid([a]), [c]);
    expect(ids(queryElementGrid(after, { x: 0, y: 0, width: 50, height: 50 }))).toEqual([c.id]);
  });

  it('matches a grid built from scratch, over randomised edits', () => {
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let els: Element[] = Array.from({ length: 60 }, () => box(rand() * 3000, rand() * 2000));
    let grid = buildElementGrid(els);
    for (let step = 0; step < 40; step++) {
      els = els
        .filter(() => rand() > 0.05)
        .map((el) => (rand() < 0.2 ? { ...el, x: rand() * 3000 } : el));
      if (rand() < 0.5) els = [...els, box(rand() * 3000, rand() * 2000)];
      grid = updateElementGrid(grid, els);
      const fresh = buildElementGrid(els);
      const q = { x: rand() * 3000, y: rand() * 2000, width: 400, height: 300 };
      expect(ids(queryElementGrid(grid, q))).toEqual(ids(queryElementGrid(fresh, q)));
    }
  });
});

describe('elementGridFor', () => {
  it('builds one grid per element list and reuses it', () => {
    const els = [box(0, 0)];
    expect(elementGridFor(els)).toBe(elementGridFor(els));
    expect(elementGridFor([...els])).not.toBe(elementGridFor(els));
  });
});

describe('createElementGridTracker', () => {
  it('follows a changing board from its last grid, the same grid for the same list', () => {
    const tracker = createElementGridTracker();
    const a = box(0, 0);
    const first = [a, box(2000, 0)];
    const g1 = tracker.gridFor(first);
    expect(tracker.gridFor(first)).toBe(g1);
    const moved = [{ ...a, x: 2000 }, first[1]!];
    const g2 = tracker.gridFor(moved);
    expect(g2).not.toBe(g1);
    expect(queryElementGrid(g2, { x: 0, y: 0, width: 50, height: 50 })).toEqual([]);
    expect(queryElementGrid(g1, { x: 0, y: 0, width: 50, height: 50 })).toHaveLength(1);
  });
});
