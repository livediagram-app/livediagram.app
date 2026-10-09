// @vitest-environment jsdom
// The grid's pointer (docs/specs/029-sheets/sheet.md "Selection", "Fill", "Rows and columns", "Freeze", "Writing
// formulas"; blueprint sheet-element.md "Pointer"): select, extend and add ranges; header selection, resizing and
// moving; the fill handle; the freeze edges; pointing into a formula; menus; touch; and autoscroll near the edges.
import { act, fireEvent, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPointingTarget, setPointingTarget } from './sheet-pointing';
import { COL_HEADER_PX, ROW_HEADER_PX } from './sheet-geometry';
import { cellPoint, gridScrolls, installGridDom, mountGrid } from './sheet-grid-test-utils';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/hooks/canvas/pan-through', async (orig) => {
  const real = await orig<typeof import('@/hooks/canvas/pan-through')>();
  return { ...real, markPanThrough: vi.fn(real.markPanThrough) };
});

let restore: () => void;
beforeAll(() => {
  restore = installGridDom();
});
afterAll(() => restore());
beforeEach(() => {
  gridScrolls.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
  clearPointingTarget('other');
});

type Mounted = Awaited<ReturnType<typeof mountGrid>>;
type Pt = { clientX: number; clientY: number };

const down = (h: Mounted, p: Pt, init: Record<string, unknown> = {}) =>
  fireEvent.pointerDown(h.viewport, { button: 0, ...p, ...init });
const move = (p: Pt) => fireEvent.pointerMove(window, p);
const up = (p: Pt, init: Record<string, unknown> = {}) =>
  fireEvent.pointerUp(window, { ...p, ...init });
const drag = (h: Mounted, from: Pt, to: Pt, init: Record<string, unknown> = {}) => {
  down(h, from, init);
  move(to);
  up(to, init);
};
const hover = (h: Mounted, p: Pt) => fireEvent.pointerMove(h.viewport, p);

// A column header's middle and right edge, a row header's middle and bottom edge, in the viewport.
const colHead = (c: number, dx = 50): Pt => ({
  clientX: ROW_HEADER_PX + c * 100 + dx,
  clientY: 10,
});
const rowHead = (r: number, dy = 12): Pt => ({ clientX: 10, clientY: COL_HEADER_PX + r * 24 + dy });

const sel = (h: Mounted) => h.c().selection;
const select = (h: Mounted, r1: number, c1: number, r2 = r1, c2 = c1) =>
  act(() =>
    h.c().setSelection({
      ranges: [{ r1, c1, r2, c2 }],
      active: { r: r1, c: c1 },
      anchor: { r: r1, c: c1 },
    }),
  );
const line = (h: Mounted) =>
  [...h.viewport.children].find((el) => (el as HTMLElement).className.includes('z-[9]')) as
    HTMLElement | undefined;

describe('selecting cells', () => {
  it('a click selects the cell and gives the grid the keys', async () => {
    const h = await mountGrid();
    drag(h, cellPoint(2, 3), cellPoint(2, 3));
    expect(sel(h).ranges).toEqual([{ r1: 2, c1: 3, r2: 2, c2: 3 }]);
    expect(document.activeElement).toBe(h.grid);
  });

  it('a drag extends the selection, and a key right after it acts on the new range', async () => {
    const h = await mountGrid();
    down(h, cellPoint(1, 1));
    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointermove', { ...cellPoint(3, 2), bubbles: true }) as PointerEvent,
      );
      // The key arrives before the move's render.
      fireEvent.keyDown(h.grid, { key: 'b', ctrlKey: true });
    });
    up(cellPoint(3, 2));
    expect(sel(h).ranges).toEqual([{ r1: 1, c1: 1, r2: 3, c2: 2 }]);
    for (const r of [1, 2, 3])
      for (const c of [1, 2])
        expect(h.c().sheet.cells.get(`row${r}:col${c}`)?.format).toEqual({ b: true });
  });

  it('a drag past the frame keeps the cell at its edge', async () => {
    const h = await mountGrid({ rows: 100, cols: 30 });
    drag(h, cellPoint(0, 0), { clientX: 5000, clientY: 5000 });
    // The last cell in view: (800 - 2 - 46) / 100 and (400 - 2 - 22) / 24.
    expect(sel(h).ranges).toEqual([{ r1: 0, c1: 0, r2: 15, c2: 7 }]);
  });

  // On a grid smaller than its frame, a drag into the empty space past the last row or column keeps the last one.
  it('a drag past the last row and column keeps the last cell', async () => {
    const h = await mountGrid({ rows: 5, cols: 3 });
    drag(h, cellPoint(0, 0), { clientX: 700, clientY: 300 });
    expect(sel(h).ranges).toEqual([{ r1: 0, c1: 0, r2: 4, c2: 2 }]);
  });

  it('Shift+click extends from the anchor, and Ctrl+click adds a range', async () => {
    const h = await mountGrid();
    drag(h, cellPoint(1, 1), cellPoint(1, 1));
    drag(h, cellPoint(3, 2), cellPoint(3, 2), { shiftKey: true });
    expect(sel(h).ranges).toEqual([{ r1: 1, c1: 1, r2: 3, c2: 2 }]);
    drag(h, cellPoint(6, 5), cellPoint(6, 5), { ctrlKey: true });
    expect(sel(h).ranges).toHaveLength(2);
    expect(sel(h).active).toEqual({ r: 6, c: 5 });
    drag(h, cellPoint(8, 0), cellPoint(8, 0), { metaKey: true });
    expect(sel(h).ranges).toHaveLength(3);
  });

  it('ignores the right button, and everything outside Plan mode', async () => {
    const h = await mountGrid();
    down(h, cellPoint(4, 4), { button: 2 });
    expect(sel(h).active).toEqual({ r: 0, c: 0 });
    const still = await mountGrid({ interactive: false });
    down(still, cellPoint(4, 4));
    hover(still, cellPoint(4, 4));
    fireEvent.doubleClick(still.viewport, cellPoint(4, 4));
    fireEvent.contextMenu(still.viewport, cellPoint(4, 4));
    expect(sel(still).active).toEqual({ r: 0, c: 0 });
    expect(still.c().menu).toBeNull();
  });
});

describe('headers', () => {
  it('a click on a column or row header selects it, and the corner selects all', async () => {
    const h = await mountGrid({ rows: 5, cols: 4 });
    drag(h, colHead(2), colHead(2));
    expect(sel(h).ranges).toEqual([{ r1: 0, c1: 2, r2: 4, c2: 2 }]);
    drag(h, rowHead(3), rowHead(3));
    expect(sel(h).ranges).toEqual([{ r1: 3, c1: 0, r2: 3, c2: 3 }]);
    down(h, { clientX: 10, clientY: 10 });
    expect(sel(h).ranges).toEqual([{ r1: 0, c1: 0, r2: 4, c2: 3 }]);
  });

  it('a drag across headers selects the run, and Shift+click extends from the anchor', async () => {
    const h = await mountGrid({ rows: 6, cols: 6 });
    drag(h, colHead(1), colHead(3));
    expect(sel(h).ranges).toEqual([{ r1: 0, c1: 1, r2: 5, c2: 3 }]);
    drag(h, rowHead(1), rowHead(4));
    expect(sel(h).ranges).toEqual([{ r1: 1, c1: 0, r2: 4, c2: 5 }]);
    select(h, 2, 1);
    drag(h, colHead(4), colHead(4), { shiftKey: true });
    expect(sel(h).ranges).toEqual([{ r1: 0, c1: 1, r2: 5, c2: 4 }]);
    select(h, 2, 1);
    drag(h, rowHead(4), rowHead(4), { shiftKey: true });
    expect(sel(h).ranges).toEqual([{ r1: 2, c1: 0, r2: 4, c2: 5 }]);
  });

  it('a drag on a header edge resizes, with a guide line, never below the least size', async () => {
    const h = await mountGrid();
    down(h, colHead(1, 98));
    move(colHead(1, 148));
    expect(line(h)?.style.left).toBe(`${ROW_HEADER_PX + 248}px`);
    up(colHead(1, 148));
    expect(h.called('resize')).toEqual([['c', [1], 150]]);
    expect(line(h)).toBeUndefined();
    drag(h, rowHead(2, 22), rowHead(2, -200));
    expect(h.called('resize').at(-1)).toEqual(['r', [2], 18]);
    drag(h, colHead(0, 98), colHead(0, -500));
    expect(h.called('resize').at(-1)).toEqual(['c', [0], 24]);
  });

  it('resizes every selected whole column or row together', async () => {
    const h = await mountGrid({ rows: 5, cols: 6 });
    drag(h, colHead(1), colHead(3));
    drag(h, colHead(2, 98), colHead(2, 118));
    expect(h.called('resize').at(-1)).toEqual(['c', [1, 2, 3], 120]);
    drag(h, rowHead(0), rowHead(1));
    drag(h, rowHead(1, 22), rowHead(1, 32));
    expect(h.called('resize').at(-1)).toEqual(['r', [0, 1], 34]);
  });

  it('a header edge only selects for someone who may not edit', async () => {
    const h = await mountGrid({ canEdit: false, rows: 5, cols: 4 });
    drag(h, colHead(1, 98), colHead(1, 98));
    expect(h.called('resize')).toEqual([]);
    expect(sel(h).ranges).toEqual([{ r1: 0, c1: 1, r2: 4, c2: 1 }]);
  });

  it('a double-click on a header edge fits the column to its contents', async () => {
    const h = await mountGrid({ cells: { B1: 'some fairly long text indeed' } });
    fireEvent.doubleClick(h.viewport, colHead(1, 98));
    expect(h.called('autofit')).toEqual([['c', [1]]]);
    fireEvent.doubleClick(h.viewport, rowHead(0, 22));
    expect(h.called('autofit').at(-1)).toEqual(['r', [0]]);
  });

  it('a drag of selected whole columns moves them, with a drop line', async () => {
    const h = await mountGrid({ rows: 5, cols: 8 });
    drag(h, colHead(1), colHead(1));
    down(h, colHead(1));
    move(colHead(4, 80));
    expect(line(h)?.style.left).toBe(`${ROW_HEADER_PX + 500}px`);
    up(colHead(4, 80));
    expect(h.called('moveAxis')).toEqual([['c', 1, 1, 5]]);
    expect(h.c().sheet.layout.cols.slice(0, 5)).toEqual(['col0', 'col2', 'col3', 'col4', 'col1']);
  });

  it('a drag of selected whole rows moves them', async () => {
    const h = await mountGrid({ rows: 8, cols: 3 });
    drag(h, rowHead(5), rowHead(5));
    down(h, rowHead(5));
    move(rowHead(1, 4));
    expect(line(h)?.style.top).toBe(`${COL_HEADER_PX + 24}px`);
    up(rowHead(1, 4));
    expect(h.called('moveAxis')).toEqual([['r', 5, 5, 1]]);
  });

  it('a press on a selected header that never moves, or drops in place, moves nothing', async () => {
    const h = await mountGrid({ rows: 5, cols: 8 });
    drag(h, colHead(1), colHead(1));
    drag(h, colHead(1), colHead(1, 52));
    drag(h, colHead(1), colHead(1, 90));
    expect(h.called('moveAxis')).toEqual([]);
  });
});

describe('the fill handle', () => {
  const handle = (r: number, c: number): Pt => ({
    clientX: ROW_HEADER_PX + (c + 1) * 100,
    clientY: COL_HEADER_PX + (r + 1) * 24,
  });

  it('a drag down fills the source onward and selects source and fill', async () => {
    const h = await mountGrid({ cells: { A1: '1', A2: '2' } });
    select(h, 0, 0, 1, 0);
    down(h, handle(1, 0));
    move(cellPoint(4, 0));
    expect(h.container.querySelectorAll('div').length).toBeGreaterThan(0);
    up(cellPoint(4, 0));
    expect(h.called('fill')).toEqual([
      [{ r1: 0, c1: 0, r2: 1, c2: 0 }, { r1: 0, c1: 0, r2: 4, c2: 0 }, false],
    ]);
    expect(sel(h).ranges).toEqual([{ r1: 0, c1: 0, r2: 4, c2: 0 }]);
  });

  it('fills in the one direction the pointer went furthest: up, left and right', async () => {
    const h = await mountGrid();
    select(h, 5, 5);
    drag(h, handle(5, 5), cellPoint(2, 5));
    expect(h.called('fill').at(-1)?.[1]).toEqual({ r1: 2, c1: 5, r2: 5, c2: 5 });
    select(h, 5, 5);
    drag(h, handle(5, 5), cellPoint(5, 2));
    expect(h.called('fill').at(-1)?.[1]).toEqual({ r1: 5, c1: 2, r2: 5, c2: 5 });
    select(h, 5, 5);
    drag(h, handle(5, 5), cellPoint(5, 7));
    expect(h.called('fill').at(-1)?.[1]).toEqual({ r1: 5, c1: 5, r2: 5, c2: 7 });
  });

  it('a drag back inside the source keeps what is left selected', async () => {
    const h = await mountGrid();
    select(h, 0, 0, 3, 0);
    drag(h, handle(3, 0), cellPoint(1, 0));
    expect(h.called('fill').at(-1)?.[1]).toEqual({ r1: 0, c1: 0, r2: 1, c2: 0 });
    expect(sel(h).ranges).toEqual([{ r1: 0, c1: 0, r2: 1, c2: 0 }]);
    select(h, 0, 0, 0, 3);
    drag(h, handle(0, 3), cellPoint(0, 2));
    expect(h.called('fill').at(-1)?.[1]).toEqual({ r1: 0, c1: 0, r2: 0, c2: 2 });
  });

  it('copies with Ctrl or Alt held, and does nothing when dropped where it began', async () => {
    const h = await mountGrid();
    select(h, 0, 0);
    drag(h, handle(0, 0), cellPoint(3, 0), { ctrlKey: true });
    expect(h.called('fill').at(-1)?.[2]).toBe(true);
    select(h, 0, 0);
    drag(h, handle(0, 0), cellPoint(0, 0));
    expect(h.called('fill')).toHaveLength(1);
  });

  it('shows a crosshair over the handle, and is not there for a viewer or while editing', async () => {
    const h = await mountGrid();
    hover(h, handle(0, 0));
    expect(h.viewport.style.cursor).toBe('crosshair');
    act(() => h.c().setEditing({ r: 0, c: 0, draft: '', origin: 'cell' }));
    hover(h, handle(0, 0));
    expect(h.viewport.style.cursor).toBe('cell');
    const viewer = await mountGrid({ canEdit: false });
    hover(viewer, handle(0, 0));
    expect(viewer.viewport.style.cursor).toBe('cell');
  });

  it('a double-click fills down as far as the column beside is filled', async () => {
    const h = await mountGrid({ cells: { A1: '1', A2: '2', A3: '3', A4: '4', B1: '9' } });
    select(h, 0, 1);
    fireEvent.doubleClick(h.viewport, handle(0, 1));
    expect(h.called('fill')).toEqual([
      [{ r1: 0, c1: 1, r2: 0, c2: 1 }, { r1: 0, c1: 1, r2: 3, c2: 1 }, false],
    ]);
    // In column A the column beside is B, filled (now) to row 4: from A4 there is nothing to do.
    select(h, 3, 0);
    fireEvent.doubleClick(h.viewport, handle(3, 0));
    expect(h.called('fill')).toHaveLength(1);
  });
});

describe('the freeze edges', () => {
  it('a drag from the corner’s right edge freezes columns', async () => {
    const h = await mountGrid();
    hover(h, { clientX: ROW_HEADER_PX + 1, clientY: 10 });
    expect(h.viewport.style.cursor).toBe('ew-resize');
    down(h, { clientX: ROW_HEADER_PX, clientY: 10 });
    move({ clientX: ROW_HEADER_PX + 210, clientY: 10 });
    expect(line(h)?.style.left).toBe(`${ROW_HEADER_PX + 200}px`);
    up({ clientX: ROW_HEADER_PX + 210, clientY: 10 });
    expect(h.called('freeze')).toEqual([[undefined, 2]]);
    expect(h.c().geometry.frozenCols).toBe(2);
  });

  it('a drag from the corner’s bottom edge freezes rows, and back unfreezes them', async () => {
    const h = await mountGrid();
    hover(h, { clientX: 10, clientY: COL_HEADER_PX + 1 });
    expect(h.viewport.style.cursor).toBe('ns-resize');
    drag(h, { clientX: 10, clientY: COL_HEADER_PX }, { clientX: 10, clientY: COL_HEADER_PX + 70 });
    expect(h.called('freeze')).toEqual([[3]]);
    expect(h.c().geometry.frozenRows).toBe(3);
    drag(h, { clientX: 10, clientY: COL_HEADER_PX + 72 }, { clientX: 10, clientY: COL_HEADER_PX });
    expect(h.called('freeze').at(-1)).toEqual([0]);
  });

  it('a drop on the same count changes nothing, and a viewer cannot grab the edge', async () => {
    const h = await mountGrid();
    drag(h, { clientX: ROW_HEADER_PX, clientY: 10 }, { clientX: ROW_HEADER_PX + 20, clientY: 10 });
    expect(h.called('freeze')).toEqual([]);
    const viewer = await mountGrid({ canEdit: false });
    hover(viewer, { clientX: ROW_HEADER_PX + 1, clientY: 10 });
    expect(viewer.viewport.style.cursor).toBe('default');
  });
});

describe('pointing into a formula', () => {
  it('a click while writing a formula puts the cell in it, and a drag makes a range', async () => {
    const points: unknown[] = [];
    const h = await mountGrid({
      pointRef: (from, to) => {
        points.push([from, to]);
        return true;
      },
    });
    act(() => h.c().setEditing({ r: 0, c: 0, draft: '=', origin: 'type' }));
    drag(h, cellPoint(2, 1), cellPoint(4, 2));
    expect(points).toEqual([
      [
        { r: 2, c: 1 },
        { r: 2, c: 1 },
      ],
      [
        { r: 2, c: 1 },
        { r: 4, c: 2 },
      ],
    ]);
    expect(sel(h).active).toEqual({ r: 0, c: 0 });
    expect(h.c().editing).not.toBeNull();
  });

  it('a click where no reference can go saves the edit, then selects', async () => {
    const h = await mountGrid();
    act(() => h.c().setEditing({ r: 0, c: 0, draft: 'hello', origin: 'type' }));
    drag(h, cellPoint(3, 3), cellPoint(3, 3));
    expect(h.called('commitEdit')).toEqual([['none']]);
    expect(h.c().editing).toBeNull();
    expect(sel(h).active).toEqual({ r: 3, c: 3 });
  });

  it('a click that cannot save the edit (a broken formula) leaves the selection where it was', async () => {
    const h = await mountGrid();
    act(() => h.c().setEditing({ r: 0, c: 0, draft: '=SUM(', origin: 'type' }));
    down(h, cellPoint(3, 3));
    expect(sel(h).active).toEqual({ r: 0, c: 0 });
    expect(h.c().editing).not.toBeNull();
  });

  it('a click on this sheet while another sheet of the tab writes a formula points into that one', async () => {
    const point = vi.fn(() => true);
    const refocus = vi.fn();
    const h = await mountGrid({ title: 'Costs' });
    setPointingTarget({ sheetId: 'other', tabId: 't1', point, refocus });
    down(h, cellPoint(1, 1));
    move(cellPoint(2, 3));
    up(cellPoint(2, 3));
    expect(point).toHaveBeenNthCalledWith(1, { r: 1, c: 1 }, { r: 1, c: 1 }, 'Costs');
    expect(point).toHaveBeenLastCalledWith({ r: 1, c: 1 }, { r: 2, c: 3 }, 'Costs');
    expect(refocus).toHaveBeenCalledTimes(1);
    expect(sel(h).active).toEqual({ r: 0, c: 0 });
  });

  it('selects as usual when the other sheet’s formula has no place for a reference', async () => {
    const h = await mountGrid();
    setPointingTarget({ sheetId: 'other', tabId: 't1', point: () => false, refocus: vi.fn() });
    drag(h, cellPoint(1, 1), cellPoint(1, 1));
    expect(sel(h).active).toEqual({ r: 1, c: 1 });
  });
});

describe('menus and the double-click', () => {
  it('a right-click on a cell outside the selection selects it and opens the cell menu', async () => {
    const h = await mountGrid();
    select(h, 0, 0, 2, 2);
    fireEvent.contextMenu(h.viewport, cellPoint(1, 1));
    expect(sel(h).ranges).toEqual([{ r1: 0, c1: 0, r2: 2, c2: 2 }]);
    expect(h.c().menu).toMatchObject({ kind: 'cell' });
    fireEvent.contextMenu(h.viewport, cellPoint(5, 5));
    expect(sel(h).ranges).toEqual([{ r1: 5, c1: 5, r2: 5, c2: 5 }]);
  });

  it('a right-click on a header selects that line unless selected, and opens the header menu', async () => {
    const h = await mountGrid({ rows: 5, cols: 5 });
    fireEvent.contextMenu(h.viewport, colHead(3));
    expect(sel(h).ranges).toEqual([{ r1: 0, c1: 3, r2: 4, c2: 3 }]);
    expect(h.c().menu).toMatchObject({ kind: 'header', axis: 'c', index: 3 });
    fireEvent.contextMenu(h.viewport, colHead(3));
    expect(sel(h).ranges).toEqual([{ r1: 0, c1: 3, r2: 4, c2: 3 }]);
    drag(h, cellPoint(0, 0), cellPoint(0, 0));
    fireEvent.contextMenu(h.viewport, rowHead(2));
    expect(sel(h).ranges).toEqual([{ r1: 2, c1: 0, r2: 2, c2: 4 }]);
    expect(h.c().menu).toMatchObject({ kind: 'header', axis: 'r', index: 2 });
    // The corner has no menu.
    act(() => h.c().setMenu(null));
    fireEvent.contextMenu(h.viewport, { clientX: 10, clientY: 10 });
    expect(h.c().menu).toBeNull();
  });

  // With column D selected, a right-click on row 3 selects row 3 (keeping D1:D5 would offer "Delete 5 Rows").
  it('a right-click on a row header while a column is selected selects that row', async () => {
    const h = await mountGrid({ rows: 5, cols: 5 });
    drag(h, colHead(3), colHead(3));
    fireEvent.contextMenu(h.viewport, rowHead(2));
    expect(sel(h).ranges).toEqual([{ r1: 2, c1: 0, r2: 2, c2: 4 }]);
  });

  it('a double-click on a cell edits it, for someone who may edit', async () => {
    const h = await mountGrid();
    fireEvent.doubleClick(h.viewport, cellPoint(0, 0));
    expect(h.called('startEdit')).toEqual([['cell']]);
    const viewer = await mountGrid({ canEdit: false });
    fireEvent.doubleClick(viewer.viewport, cellPoint(0, 0));
    expect(viewer.called('startEdit')).toEqual([]);
  });
});

describe('cursors', () => {
  it('shows resize cursors on header edges, a cell cursor on cells and the default elsewhere', async () => {
    const h = await mountGrid({ rows: 3, cols: 3 });
    hover(h, colHead(1, 98));
    expect(h.viewport.style.cursor).toBe('col-resize');
    hover(h, rowHead(1, 22));
    expect(h.viewport.style.cursor).toBe('row-resize');
    hover(h, cellPoint(1, 1));
    expect(h.viewport.style.cursor).toBe('cell');
    hover(h, colHead(1));
    expect(h.viewport.style.cursor).toBe('default');
    const viewer = await mountGrid({ canEdit: false });
    hover(viewer, colHead(1, 98));
    expect(viewer.viewport.style.cursor).toBe('default');
  });

  it('keeps the cursor while a drag is under way', async () => {
    const h = await mountGrid();
    hover(h, cellPoint(0, 0));
    down(h, cellPoint(0, 0));
    hover(h, colHead(1, 98));
    expect(h.viewport.style.cursor).toBe('cell');
    up(cellPoint(0, 0));
  });
});

describe('touch', () => {
  const tap = (h: Mounted, p: Pt) => {
    const ev = new MouseEvent('click', { bubbles: true, ...p });
    Object.defineProperty(ev, 'pointerType', { value: 'touch' });
    act(() => {
      h.viewport.dispatchEvent(ev);
    });
  };

  it('a finger on a sheet pans its cells (not the canvas), and a tap selects', async () => {
    const h = await mountGrid();
    let throughToCanvas = false;
    const listen = () => (throughToCanvas = true);
    document.addEventListener('pointerdown', listen);
    fireEvent.pointerDown(h.viewport, { ...cellPoint(3, 3), pointerType: 'touch' });
    document.removeEventListener('pointerdown', listen);
    // The sheet took the press: it never reaches the canvas, and selects nothing until a tap.
    expect(throughToCanvas).toBe(false);
    expect(sel(h).active).toEqual({ r: 0, c: 0 });
    up(cellPoint(3, 3));
    tap(h, cellPoint(3, 3));
    expect(sel(h).active).toEqual({ r: 3, c: 3 });
  });

  it('a tap saves an edit first, and a tap off the cells does nothing', async () => {
    const h = await mountGrid();
    act(() => h.c().setEditing({ r: 0, c: 0, draft: 'x', origin: 'type' }));
    tap(h, cellPoint(2, 2));
    expect(h.called('commitEdit')).toEqual([['none']]);
    tap(h, colHead(1));
    expect(sel(h).active).toEqual({ r: 2, c: 2 });
  });

  it('a mouse click, or a tap on a maximised sheet, is left to the pointer press', async () => {
    const h = await mountGrid();
    fireEvent.click(h.viewport, cellPoint(3, 3));
    expect(sel(h).active).toEqual({ r: 0, c: 0 });
    const big = await mountGrid({ maximised: true });
    tap(big, cellPoint(3, 3));
    expect(sel(big).active).toEqual({ r: 0, c: 0 });
    // Maximised, a finger selects (and scrolls) rather than panning the canvas.
    fireEvent.pointerDown(big.viewport, { ...cellPoint(2, 2), pointerType: 'touch', button: 0 });
    up(cellPoint(2, 2));
    expect(sel(big).active).toEqual({ r: 2, c: 2 });
  });

  it('takes a middle-button press to pan, selecting nothing', async () => {
    const h = await mountGrid();
    fireEvent.pointerDown(h.viewport, { ...cellPoint(2, 2), button: 1 });
    up(cellPoint(2, 2));
    expect(sel(h).active).toEqual({ r: 0, c: 0 });
  });
});

describe('autoscroll', () => {
  it('scrolls the grid while a drag is near an edge, and the drag follows', async () => {
    const h = await mountGrid({ rows: 100, cols: 30 });
    vi.useFakeTimers();
    down(h, cellPoint(2, 2));
    move({ clientX: 790, clientY: 395 });
    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(gridScrolls).toContainEqual(['by', { left: 24, top: 24 }]);
    move({ clientX: ROW_HEADER_PX + 2, clientY: COL_HEADER_PX + 2 });
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(gridScrolls).toContainEqual(['by', { left: -24, top: -24 }]);
    up({ clientX: 300, clientY: 200 });
    const after = gridScrolls.length;
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(gridScrolls).toHaveLength(after);
  });

  it('does not scroll in the middle, nor while resizing', async () => {
    const h = await mountGrid({ rows: 100, cols: 30 });
    vi.useFakeTimers();
    down(h, cellPoint(2, 2));
    move({ clientX: 300, clientY: 200 });
    act(() => {
      vi.advanceTimersByTime(120);
    });
    up({ clientX: 300, clientY: 200 });
    down(h, colHead(1, 98));
    move({ clientX: 795, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(120);
    });
    up({ clientX: 795, clientY: 10 });
    expect(gridScrolls.filter(([k]) => k === 'by')).toEqual([]);
  });

  it('stops listening when the grid goes mid-drag', async () => {
    const h = await mountGrid();
    vi.useFakeTimers();
    down(h, cellPoint(1, 1));
    h.unmount();
    expect(() => {
      move(cellPoint(3, 3));
      vi.advanceTimersByTime(200);
    }).not.toThrow();
    expect(screen.queryByRole('grid')).toBeNull();
  });
});
