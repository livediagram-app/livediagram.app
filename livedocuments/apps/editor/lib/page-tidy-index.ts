// A grid over a level's rects for Tidy Up's pair checks (docs/specs/007-editor/pages-mode.md "Tidy"; lib/page-tidy.ts):
// which rects may touch a given one, so the guard, the overlaps a level starts with and each element's parent look at
// their neighbours, not every pair on the page. A query answers a superset of the rects touching it, in index order,
// so a caller that still checks each one visits the same pairs in the same order as a loop over all of them.
import type { Rect } from './page-tidy-blocks';

// Cells along the wider side of the rects' span at most: a page of a thousand cards is a 64 by 64 grid.
const MAX_CELLS = 64;
// A rect over more cells than this (a page-wide background) is kept aside and answered by every query.
const MAX_RECT_CELLS = 256;
// A cell's key: its column and row, offset so neither is negative, packed in one number.
const OFFSET = 2 ** 20;
const keyOf = (x: number, y: number) => (x + OFFSET) * 2 ** 21 + (y + OFFSET);

export type RectIndex = {
  /** The indices of the rects that may touch `r` grown by `pad` on each side, ascending. */
  query(r: Rect, pad?: number): number[];
  /** Rect `i` is now `r`. */
  move(i: number, r: Rect): void;
};

type Span = { x0: number; y0: number; x1: number; y1: number };

/** An index over `rects`; a null one is left out (never answered). */
export function rectIndex(rects: readonly (Rect | null)[]): RectIndex {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let sides = 0;
  let count = 0;
  for (const r of rects) {
    if (!r) continue;
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
    sides += (Math.abs(r.width) + Math.abs(r.height)) / 2;
    count++;
  }
  // About one rect a cell: the rects' mean side, but never more than MAX_CELLS along the span.
  const span = count > 0 ? Math.max(maxX - minX, maxY - minY) : 0;
  const cell = Math.max(1, sides / Math.max(1, count), span / MAX_CELLS);
  const at = (v: number) => Math.floor(v / cell);
  const spanOf = (r: Rect, pad: number): Span => ({
    x0: at(Math.min(r.x, r.x + r.width) - pad),
    y0: at(Math.min(r.y, r.y + r.height) - pad),
    x1: at(Math.max(r.x, r.x + r.width) + pad),
    y1: at(Math.max(r.y, r.y + r.height) + pad),
  });
  const cells = new Map<number, number[]>();
  const wide = new Set<number>();
  const spans: (Span | null)[] = rects.map(() => null);
  const isWide = (s: Span) => (s.x1 - s.x0 + 1) * (s.y1 - s.y0 + 1) > MAX_RECT_CELLS;
  const add = (i: number, r: Rect) => {
    const s = spanOf(r, 0);
    spans[i] = s;
    if (isWide(s)) {
      wide.add(i);
      return;
    }
    for (let x = s.x0; x <= s.x1; x++)
      for (let y = s.y0; y <= s.y1; y++) {
        const key = keyOf(x, y);
        const list = cells.get(key);
        if (list) list.push(i);
        else cells.set(key, [i]);
      }
  };
  rects.forEach((r, i) => r && add(i, r));
  const seen = new Uint32Array(rects.length);
  let stamp = 0;
  return {
    query(r, pad = 0) {
      stamp++;
      const out: number[] = [];
      const take = (i: number) => {
        if (seen[i] === stamp) return;
        seen[i] = stamp;
        out.push(i);
      };
      wide.forEach(take);
      const s = spanOf(r, pad);
      if (isWide(s)) {
        // A query over most of the grid: every rect, without walking its cells.
        spans.forEach((sp, i) => sp && take(i));
      } else {
        for (let x = s.x0; x <= s.x1; x++)
          for (let y = s.y0; y <= s.y1; y++) cells.get(keyOf(x, y))?.forEach(take);
      }
      return out.sort((p, q) => p - q);
    },
    move(i, r) {
      const s = spans[i];
      if (s && !wide.delete(i)) {
        for (let x = s.x0; x <= s.x1; x++)
          for (let y = s.y0; y <= s.y1; y++) {
            const key = keyOf(x, y);
            const list = cells.get(key)!.filter((j) => j !== i);
            if (list.length > 0) cells.set(key, list);
            else cells.delete(key);
          }
      }
      add(i, r);
    },
  };
}
