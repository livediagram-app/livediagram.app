// Cell comment markers (docs/specs/029-sheets/sheet.md "Cell comments"): which cells show one, kept per change, what
// the preview says, the shortcut, and the cost at the bounds (1,000 threads on a 10,000-row sheet).
import { describe, expect, it } from 'vitest';
import { CELL_THREADS_MAX, type CellCommentThreads, type Comment } from '@liveplanner/document';
import type { SheetLayout } from '@liveplanner/sheets';
import {
  CELL_PREVIEW_CHARS,
  cellKeyAt,
  cellMarkers,
  cellPreview,
  isCommentShortcut,
} from './sheet-cell-comments';

const comment = (text: string): Comment => ({
  id: text,
  text,
  createdAt: 0,
  authorName: 'Priya',
  authorColor: '#000',
});

const layout = (rows: number, cols: number): SheetLayout => ({
  rows: Array.from({ length: rows }, (_, i) => `r${i}`),
  cols: Array.from({ length: cols }, (_, i) => `c${i}`),
});

describe('cellMarkers', () => {
  it('marks open threads of cells still on the sheet, and keeps the list per change', () => {
    const l = layout(3, 3);
    const threads: CellCommentThreads = {
      'r1:c2': { comments: [comment('a'), comment('b')], resolved: false },
      'r2:c0': { comments: [comment('c')], resolved: true },
      'r0:c0': { comments: [], resolved: false },
      'gone:c0': { comments: [comment('d')], resolved: false },
    };
    const markers = cellMarkers(threads, l);
    expect(markers.map((m) => [m.cell, m.r, m.c, m.count])).toEqual([['r1:c2', 1, 2, 2]]);
    expect(cellMarkers(threads, l)).toBe(markers);
    // A new layout (a row moved) works them out again.
    const moved = { ...l, rows: ['r1', 'r0', 'r2'] };
    expect(cellMarkers(threads, moved)[0]!.r).toBe(0);
    expect(cellMarkers(undefined, l)).toEqual([]);
  });

  it('works out 1,000 threads on a 10,000-row sheet within a frame, and reads them back for nothing', () => {
    const l = layout(10_000, 26);
    const threads: CellCommentThreads = {};
    for (let i = 0; i < CELL_THREADS_MAX; i++)
      threads[`r${i * 10}:c${i % 26}`] = { comments: [comment(`t${i}`)], resolved: false };
    // The layout's index is the engine's, kept per layout; the first read pays for it.
    let t = performance.now();
    expect(cellMarkers(threads, l)).toHaveLength(CELL_THREADS_MAX);
    const first = performance.now() - t;
    t = performance.now();
    for (let i = 0; i < 100; i++) cellMarkers(threads, l);
    const reads = (performance.now() - t) / 100;
    expect(first).toBeLessThan(50);
    expect(reads).toBeLessThan(0.1);
  });
});

describe('the rest', () => {
  it('names a position by its cell key', () => {
    expect(cellKeyAt(layout(2, 2), 1, 0)).toBe('r1:c0');
    expect(cellKeyAt(layout(2, 2), 5, 0)).toBeNull();
  });

  it('previews the first comment, cut, with how many follow', () => {
    expect(cellPreview({ count: 1, first: comment('  Hi  ') })).toEqual({
      author: 'Priya',
      text: 'Hi',
      more: null,
    });
    const long = cellPreview({ count: 3, first: comment('x'.repeat(500)) });
    expect(long.text).toHaveLength(CELL_PREVIEW_CHARS);
    expect(long.text.endsWith('…')).toBe(true);
    expect(long.more).toBe('2 more');
  });

  it('reads Ctrl or Cmd with Alt and M, by code', () => {
    const k = (over: Partial<Parameters<typeof isCommentShortcut>[0]>) =>
      isCommentShortcut({
        code: 'KeyM',
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        ...over,
      });
    expect(k({ ctrlKey: true })).toBe(true);
    expect(k({ metaKey: true })).toBe(true);
    expect(k({})).toBe(false);
    expect(k({ ctrlKey: true, shiftKey: true })).toBe(false);
    expect(k({ ctrlKey: true, code: 'KeyN' })).toBe(false);
  });
});
