// Which page a point falls on, for splitting a Pages tab by page (docs/migration.md, step 3): a uniform grid over the
// pages' rectangles, so each lookup reads a handful of candidates rather than every page, and a tab of thousands of
// elements over hundreds of pages stays linear. The cell is the typical page's size, so a page covers a few cells.

export type PageRect = { pageId: string; x: number; y: number; width: number; height: number };

type Entry = { rect: PageRect; order: number };

const finite = (n: number) => Number.isFinite(n);

// A page spanning more cells than this (a fit-to-content poster far bigger than the rest) is kept in one list read on
// every lookup instead, so a forged rectangle can't make the grid huge.
const MAX_CELLS_PER_PAGE = 64;

export class PageIndex {
  private readonly cell: number;
  private readonly cells = new Map<string, Entry[]>();
  private readonly big: Entry[] = [];

  constructor(rects: readonly PageRect[]) {
    const usable: Entry[] = [];
    rects.forEach((rect, order) => {
      if (
        [rect.x, rect.y, rect.width, rect.height].every(finite) &&
        rect.width > 0 &&
        rect.height > 0
      ) {
        usable.push({ rect, order });
      }
    });
    const sides = usable.map((e) => Math.max(e.rect.width, e.rect.height)).sort((a, b) => a - b);
    this.cell = Math.max(1, sides[Math.floor(sides.length / 2)] ?? 1);
    for (const entry of usable) {
      const r = entry.rect;
      const x0 = Math.floor(r.x / this.cell);
      const x1 = Math.floor((r.x + r.width) / this.cell);
      const y0 = Math.floor(r.y / this.cell);
      const y1 = Math.floor((r.y + r.height) / this.cell);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_CELLS_PER_PAGE) {
        this.big.push(entry);
        continue;
      }
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const key = `${cx},${cy}`;
          const list = this.cells.get(key);
          if (list) list.push(entry);
          else this.cells.set(key, [entry]);
        }
      }
    }
  }

  /** The earliest page (in the order given) whose rectangle holds the point, edges included, or null. */
  pageAt(x: number, y: number): string | null {
    if (!finite(x) || !finite(y)) return null;
    let best: Entry | null = null;
    const lists = [
      this.cells.get(`${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`),
      this.big,
    ];
    for (const list of lists) {
      if (!list) continue;
      for (const entry of list) {
        const r = entry.rect;
        if (x < r.x || y < r.y || x > r.x + r.width || y > r.y + r.height) continue;
        if (!best || entry.order < best.order) best = entry;
      }
    }
    return best ? best.rect.pageId : null;
  }
}
