// @vitest-environment jsdom
// A finger on a Sheet's grid (docs/specs/029-sheets/sheet.md "On a touch screen"; blueprint sheet-element.md
// "Pointer"): a held finger grabs a cell or header, a drag from there selects a range or lines, a hold let go
// unmoved opens the menu, the selection's grip drags its corner, a second finger is never a hold, and the
// page never scrolls under a finger that selects.
import { act, fireEvent } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LONG_PRESS_MS } from '@/hooks/ui/useLongPress';
import { COL_HEADER_PX, ROW_HEADER_PX } from './sheet-geometry';
import { cellPoint, installGridDom, mountGrid } from './sheet-grid-test-utils';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

let restore: () => void;
beforeAll(() => {
  restore = installGridDom();
});
afterAll(() => restore());
afterEach(() => {
  vi.useRealTimers();
});

type Mounted = Awaited<ReturnType<typeof mountGrid>>;
type Pt = { clientX: number; clientY: number };

const finger = (h: Mounted, p: Pt, init: Record<string, unknown> = {}) =>
  fireEvent.pointerDown(h.viewport, {
    button: 0,
    pointerType: 'touch',
    isPrimary: true,
    pointerId: 1,
    ...p,
    ...init,
  });
const move = (p: Pt) => fireEvent.pointerMove(window, { pointerId: 1, ...p });
const lift = (p: Pt) => fireEvent.pointerUp(window, { pointerId: 1, ...p });
const hold = () =>
  act(() => {
    vi.advanceTimersByTime(LONG_PRESS_MS);
  });
const tap = (h: Mounted, p: Pt) => {
  const ev = new MouseEvent('click', { bubbles: true, ...p });
  Object.defineProperty(ev, 'pointerType', { value: 'touch' });
  act(() => {
    h.viewport.dispatchEvent(ev);
  });
};
const sel = (h: Mounted) => h.c().selection;
const colHead = (c: number): Pt => ({ clientX: ROW_HEADER_PX + c * 100 + 50, clientY: 10 });

describe('a held finger', () => {
  it('grabs the cell, and a drag from there selects a range; its release is not a tap', async () => {
    const h = await mountGrid();
    vi.useFakeTimers();
    finger(h, cellPoint(1, 1));
    hold();
    expect(sel(h).ranges).toEqual([{ r1: 1, c1: 1, r2: 1, c2: 1 }]);
    move(cellPoint(3, 2));
    move(cellPoint(3, 2));
    lift(cellPoint(3, 2));
    expect(sel(h).ranges).toEqual([{ r1: 1, c1: 1, r2: 3, c2: 2 }]);
    expect(h.c().menu).toBeNull();
    tap(h, cellPoint(3, 2));
    expect(sel(h).ranges).toEqual([{ r1: 1, c1: 1, r2: 3, c2: 2 }]);
  });

  it('let go unmoved opens the menu, keeping a selection it is inside', async () => {
    const h = await mountGrid();
    act(() =>
      h.c().setSelection({
        ranges: [{ r1: 1, c1: 1, r2: 3, c2: 3 }],
        active: { r: 1, c: 1 },
        anchor: { r: 1, c: 1 },
      }),
    );
    vi.useFakeTimers();
    finger(h, cellPoint(2, 2));
    hold();
    lift(cellPoint(2, 2));
    expect(h.c().menu).toMatchObject({ kind: 'cell' });
    expect(sel(h).ranges).toEqual([{ r1: 1, c1: 1, r2: 3, c2: 3 }]);
  });

  it('on a header opens its menu, or drags across headers to select several', async () => {
    const h = await mountGrid();
    vi.useFakeTimers();
    finger(h, colHead(2));
    hold();
    lift(colHead(2));
    expect(h.c().menu).toMatchObject({ kind: 'header', axis: 'c', index: 2 });
    act(() => h.c().setMenu(null));
    vi.advanceTimersByTime(1000);
    finger(h, colHead(1));
    hold();
    move(colHead(3));
    move(colHead(3));
    lift(colHead(3));
    expect(sel(h).ranges).toEqual([{ r1: 0, c1: 1, r2: h.c().grid.rows - 1, c2: 3 }]);
    expect(h.c().menu).toBeNull();
  });

  it('that moves first is a pan, never a hold', async () => {
    const h = await mountGrid();
    vi.useFakeTimers();
    finger(h, cellPoint(1, 1));
    move({ clientX: cellPoint(1, 1).clientX + 30, clientY: cellPoint(1, 1).clientY });
    hold();
    lift({ clientX: cellPoint(1, 1).clientX + 30, clientY: cellPoint(1, 1).clientY });
    expect(sel(h).active).toEqual({ r: 0, c: 0 });
    expect(h.c().menu).toBeNull();
  });

  it('is let go when a second finger lands (a pinch)', async () => {
    const h = await mountGrid();
    vi.useFakeTimers();
    finger(h, cellPoint(1, 1));
    finger(h, cellPoint(4, 4), { isPrimary: false, pointerId: 2 });
    hold();
    lift(cellPoint(1, 1));
    expect(sel(h).active).toEqual({ r: 0, c: 0 });
    expect(h.c().menu).toBeNull();
  });

  it('keeps the page from scrolling under it until it lifts', async () => {
    const h = await mountGrid();
    vi.useFakeTimers();
    finger(h, cellPoint(1, 1));
    hold();
    const scroll = new Event('touchmove', { cancelable: true });
    window.dispatchEvent(scroll);
    expect(scroll.defaultPrevented).toBe(true);
    lift(cellPoint(1, 1));
    const after = new Event('touchmove', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it('leaves the browser’s own long-press menu unopened', async () => {
    const h = await mountGrid();
    const ev = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      ...cellPoint(1, 1),
    });
    Object.defineProperty(ev, 'pointerType', { value: 'touch' });
    act(() => {
      h.viewport.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(true);
    expect(h.c().menu).toBeNull();
  });
});

describe('the selection’s grip', () => {
  it('drags the range’s far corner, its top left staying put', async () => {
    const h = await mountGrid();
    act(() => {
      h.c().setFocused(true);
      h.c().setSelection({
        ranges: [{ r1: 1, c1: 1, r2: 2, c2: 2 }],
        active: { r: 2, c: 2 },
        anchor: { r: 2, c: 2 },
      });
    });
    // The range's bottom right corner, a finger's width off.
    const corner = { clientX: ROW_HEADER_PX + 3 * 100 + 12, clientY: COL_HEADER_PX + 3 * 24 + 10 };
    finger(h, corner);
    move(cellPoint(5, 4));
    lift(cellPoint(5, 4));
    expect(sel(h).ranges).toEqual([{ r1: 1, c1: 1, r2: 5, c2: 4 }]);
  });

  it('is not there while the grid does not have the keys', async () => {
    const h = await mountGrid();
    act(() => {
      h.c().setFocused(false);
      h.c().setSelection({
        ranges: [{ r1: 1, c1: 1, r2: 2, c2: 2 }],
        active: { r: 1, c: 1 },
        anchor: { r: 1, c: 1 },
      });
    });
    finger(h, { clientX: ROW_HEADER_PX + 3 * 100, clientY: COL_HEADER_PX + 3 * 24 });
    move(cellPoint(5, 4));
    lift(cellPoint(5, 4));
    expect(sel(h).ranges).toEqual([{ r1: 1, c1: 1, r2: 2, c2: 2 }]);
  });
});
