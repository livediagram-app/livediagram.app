import { describe, expect, it } from 'vitest';
import { ROUTE_GRID_CELL, rectGrid } from './auto-layout-route-grid';

// docs/specs/008-canvas/blueprints/tidy-up.md "Performance and limits": the router tests a leg
// against the boxes near it, so the grid must never miss a box a leg could hit.
describe('rectGrid', () => {
  const rects = Array.from({ length: 60 }, (_, i) => ({
    x: (i * 137) % 1500,
    y: (i * 89) % 900,
    width: 40 + (i % 5) * 30,
    height: 30 + (i % 3) * 20,
  }));
  const meets = (
    r: (typeof rects)[number],
    pad: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ) => x1 > r.x - pad && x0 < r.x + r.width + pad && y1 > r.y - pad && y0 < r.y + r.height + pad;

  it('returns every box a query meets, each once', () => {
    for (let i = 0; i < 200; i++) {
      const x0 = (i * 53) % 1600;
      const y0 = (i * 31) % 1000;
      const [x1, y1] = i % 2 ? [x0 + (i % 7) * 90, y0] : [x0, y0 + (i % 9) * 70];
      const near = rectGrid(rects, 10).near(x0, y0, x1, y1);
      expect(new Set(near).size).toBe(near.length);
      for (const r of rects) if (meets(r, 10, x0, y0, x1, y1)) expect(near).toContain(r);
    }
  });

  it('leaves out boxes a cell away', () => {
    const grid = rectGrid([{ x: 0, y: 0, width: 10, height: 10 }], 0);
    expect(grid.near(ROUTE_GRID_CELL * 3, 0, ROUTE_GRID_CELL * 4, 0)).toEqual([]);
  });

  it('reuses its stamp across queries', () => {
    const grid = rectGrid(rects, 10);
    expect(grid.near(0, 0, 1600, 1000)).toHaveLength(rects.length);
    expect(grid.near(0, 0, 1600, 1000)).toHaveLength(rects.length);
  });
});
