// @vitest-environment jsdom
// The grid (docs/specs/029-sheets/sheet.md "The grid", "Keyboard"; blueprint sheet-element.md "Keyboard and
// focus"): the keyboard map dispatched to the actions, Escape's order, what keeps Escape from the canvas, the
// Add Rows footer, the error tooltip, presence, Find's highlights, the filter's buttons and the wheel.
import { act, fireEvent, screen } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { restorePlanElement } from '@/hooks/plan/maximised-plan';
import { sheetPresenceFor } from './sheet-presence-store';
import { cellPoint, gridScrolls, installGridDom, mountGrid } from './sheet-grid-test-utils';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/hooks/plan/maximised-plan', async (orig) => ({
  ...(await orig<typeof import('@/hooks/plan/maximised-plan')>()),
  restorePlanElement: vi.fn(),
}));
const clipboard = {
  onCopy: vi.fn(),
  onCut: vi.fn(),
  onPaste: vi.fn(),
  pasteSpecial: vi.fn(async () => {}),
};
vi.mock('./useSheetClipboard', () => ({ useSheetClipboard: () => clipboard }));

let restore: () => void;
beforeAll(() => {
  restore = installGridDom();
});
afterAll(() => restore());
beforeEach(() => {
  vi.clearAllMocks();
  gridScrolls.length = 0;
});

type Mounted = Awaited<ReturnType<typeof mountGrid>>;
const key = (h: Mounted, init: Parameters<typeof fireEvent.keyDown>[1]) =>
  fireEvent.keyDown(h.grid, init);
const active = (h: Mounted) => h.c().selection.active;
const range = (h: Mounted) => h.c().selection.ranges.at(-1);
const select = (h: Mounted, r1: number, c1: number, r2 = r1, c2 = c1) =>
  act(() =>
    h.c().setSelection({
      ranges: [{ r1, c1, r2, c2 }],
      active: { r: r1, c: c1 },
      anchor: { r: r1, c: c1 },
    }),
  );

describe('the grid frame', () => {
  it('is one tab stop named for the sheet, sized to the sheet', async () => {
    const h = await mountGrid({ rows: 5, cols: 3, title: 'Budget' });
    expect(h.grid.getAttribute('aria-label')).toBe('Budget grid');
    expect(h.grid.tabIndex).toBe(0);
    expect(h.grid.getAttribute('aria-rowcount')).toBe('5');
    expect(h.grid.getAttribute('aria-colcount')).toBe('3');
    expect(h.grid.getAttribute('aria-activedescendant')).toBe('el1-A1');
  });

  // docs/specs/029-sheets/sheet.md "Zoom": laid out at 1 / zoom of its frame and scaled back up, so it fills the
  // frame at any zoom; at 100% it is the frame's own size.
  it('draws at the covering Sheet’s zoom, filling its frame', async () => {
    const plain = await mountGrid({ rows: 5, cols: 3 });
    expect(plain.grid.style.transform).toBe('');
    plain.unmount?.();
    const h = await mountGrid({ rows: 5, cols: 3, zoom: 1.25 });
    expect(h.grid.style.transform).toBe('scale(1.25)');
    expect(h.grid.style.width).toBe('80%');
    expect(h.grid.style.height).toBe('80%');
    expect(h.grid.parentElement!.hasAttribute('data-sheet-grid-frame')).toBe(true);
  });

  it('says the active cell and its value to assistive technology', async () => {
    const h = await mountGrid({ cells: { B2: '42' } });
    select(h, 1, 1);
    expect(screen.getByRole('gridcell').textContent).toBe('B2 42');
  });

  it('takes no keys and draws no selection outside Plan mode', async () => {
    const h = await mountGrid({ interactive: false });
    expect(h.grid.tabIndex).toBe(-1);
    expect(h.container.querySelector('[data-sheet-fill-handle]')).toBeNull();
    expect(
      screen.queryAllByRole('columnheader').some((el) => el.dataset.selected !== undefined),
    ).toBe(false);
  });

  it('keeps its scroll, for what it draws', async () => {
    const h = await mountGrid({ rows: 100 });
    Object.defineProperty(h.grid, 'scrollTop', { configurable: true, value: 480 });
    Object.defineProperty(h.grid, 'scrollLeft', { configurable: true, value: 0 });
    fireEvent.scroll(h.grid);
    expect(h.c().scroll).toEqual({ top: 480, left: 0 });
    expect(screen.getAllByRole('rowheader')[0]!.textContent).not.toBe('1');
  });

  it('scrolls to keep the active cell in view', async () => {
    const h = await mountGrid({ rows: 100 });
    select(h, 40, 0);
    expect(gridScrolls).toContainEqual(['to', { top: 40 * 24 + 24 - (400 - 22), left: 0 }]);
  });
});

describe('the keyboard map', () => {
  it('moves with the arrows and extends with Shift', async () => {
    const h = await mountGrid();
    key(h, { key: 'ArrowRight' });
    expect(active(h)).toEqual({ r: 0, c: 1 });
    key(h, { key: 'ArrowDown', shiftKey: true });
    expect(range(h)).toEqual({ r1: 0, c1: 1, r2: 1, c2: 1 });
    expect(h.called('move')).toEqual([
      ['right', false, false],
      ['down', false, true],
    ]);
  });

  it('acts on the selection as last set, not the render’s copy', async () => {
    const h = await mountGrid();
    act(() => {
      h.c().setSelection({
        ranges: [{ r1: 0, c1: 0, r2: 2, c2: 0 }],
        active: { r: 0, c: 0 },
        anchor: { r: 0, c: 0 },
      });
      // Before that render: Enter cycles in the new three-cell range rather than editing one cell.
      fireEvent.keyDown(h.grid, { key: 'Enter' });
    });
    expect(h.called('startEdit')).toEqual([]);
    expect(active(h)).toEqual({ r: 1, c: 0 });
  });

  it('Tab moves right in one cell, and cycles within a range', async () => {
    const h = await mountGrid();
    key(h, { key: 'Tab' });
    expect(active(h)).toEqual({ r: 0, c: 1 });
    key(h, { key: 'Tab', shiftKey: true });
    expect(active(h)).toEqual({ r: 0, c: 0 });
    select(h, 0, 0, 1, 1);
    key(h, { key: 'Tab' });
    expect(active(h)).toEqual({ r: 0, c: 1 });
    expect(range(h)).toEqual({ r1: 0, c1: 0, r2: 1, c2: 1 });
    key(h, { key: 'Tab', shiftKey: true });
    expect(active(h)).toEqual({ r: 0, c: 0 });
  });

  it('Enter edits one cell, Shift+Enter moves up, and both cycle down a range', async () => {
    const h = await mountGrid();
    select(h, 3, 0);
    key(h, { key: 'Enter', shiftKey: true });
    expect(active(h)).toEqual({ r: 2, c: 0 });
    select(h, 0, 0, 1, 1);
    key(h, { key: 'Enter' });
    expect(active(h)).toEqual({ r: 1, c: 0 });
    key(h, { key: 'Enter', shiftKey: true });
    expect(active(h)).toEqual({ r: 0, c: 0 });
    select(h, 0, 0);
    key(h, { key: 'Enter' });
    expect(h.called('startEdit')).toEqual([['cell']]);
    expect(h.c().editing).toMatchObject({ r: 0, c: 0, origin: 'cell' });
  });

  it('F2 edits, and typing starts an edit with the key typed', async () => {
    const h = await mountGrid();
    key(h, { key: 'F2' });
    expect(h.c().editing?.origin).toBe('cell');
    act(() => h.c().setEditing(null));
    key(h, { key: 'x' });
    expect(h.c().editing).toMatchObject({ draft: 'x', origin: 'type' });
  });

  it('ignores keys while a cell is edited, and keys from inside the frame', async () => {
    const h = await mountGrid();
    act(() => h.c().setEditing({ r: 0, c: 0, draft: '', origin: 'cell' }));
    key(h, { key: 'ArrowDown' });
    expect(active(h)).toEqual({ r: 0, c: 0 });
    act(() => h.c().setEditing(null));
    fireEvent.keyDown(screen.getAllByRole('rowheader')[0]!, { key: 'ArrowDown' });
    expect(active(h)).toEqual({ r: 0, c: 0 });
    // A key the map does not know does nothing.
    key(h, { key: 'Shift', shiftKey: true });
    expect(h.calls).toEqual([]);
  });

  it('Home, End and Ctrl+End go to the row’s and the sheet’s edges', async () => {
    const h = await mountGrid({ cells: { A1: '1', C5: '2' } });
    select(h, 1, 1);
    key(h, { key: 'End', ctrlKey: true });
    expect(active(h)).toEqual({ r: 4, c: 2 });
    key(h, { key: 'Home' });
    expect(active(h)).toEqual({ r: 4, c: 0 });
  });

  it('Page Down and Page Up move by a page of rows', async () => {
    const h = await mountGrid({ rows: 100 });
    key(h, { key: 'PageDown' });
    // (400 view - 22 header) / 24 rows.
    expect(active(h).r).toBe(15);
    key(h, { key: 'PageUp' });
    expect(active(h).r).toBe(0);
  });

  it('selects all, the row and the column', async () => {
    const h = await mountGrid({ rows: 5, cols: 4 });
    select(h, 1, 1);
    key(h, { key: ' ', shiftKey: true });
    expect(range(h)).toEqual({ r1: 1, c1: 0, r2: 1, c2: 3 });
    select(h, 1, 1);
    key(h, { key: ' ', ctrlKey: true });
    expect(range(h)).toEqual({ r1: 0, c1: 1, r2: 4, c2: 1 });
    key(h, { key: 'a', metaKey: true });
    expect(range(h)).toEqual({ r1: 0, c1: 0, r2: 4, c2: 3 });
  });

  it('Delete clears inputs and Ctrl/Cmd+B toggles bold, for someone who may edit', async () => {
    const h = await mountGrid({ cells: { A1: 'x' } });
    key(h, { key: 'b', ctrlKey: true });
    expect(h.called('toggle')).toEqual([['b']]);
    key(h, { key: 'Delete' });
    expect(h.called('clear')).toEqual([['inputs']]);
    // Applied at once: A1 is bold and empty.
    expect(h.c().sheet.cells.get('row0:col0')).toEqual({ format: { b: true } });
  });

  it('runs the other edit keys: today’s date, fill down and number formats', async () => {
    const h = await mountGrid();
    key(h, { key: ';', ctrlKey: true });
    key(h, { key: 'd', ctrlKey: true });
    key(h, { key: '!', code: 'Digit1', ctrlKey: true, shiftKey: true });
    expect(h.called('typeNow')).toEqual([['date']]);
    expect(h.called('fillEdge')).toEqual([['down']]);
    expect(h.called('numberFormat')).toEqual([['number']]);
  });

  it('refuses the edit keys to someone who may only look', async () => {
    const h = await mountGrid({ canEdit: false, cells: { A1: 'x' } });
    for (const init of [
      { key: 'Delete' },
      { key: 'b', ctrlKey: true },
      { key: ';', ctrlKey: true },
      { key: 'd', ctrlKey: true },
      { key: '!', code: 'Digit1', ctrlKey: true, shiftKey: true },
    ])
      key(h, init);
    expect(h.calls).toEqual([]);
    expect(h.c().sheet.cells.get('row0:col0')?.format).toBeUndefined();
  });

  it('Ctrl+Shift+V pastes values only', async () => {
    const h = await mountGrid();
    key(h, { key: 'V', ctrlKey: true, shiftKey: true });
    expect(clipboard.pasteSpecial).toHaveBeenCalledWith('values');
  });

  it('opens Find, and Replace only for someone who may edit', async () => {
    const h = await mountGrid();
    key(h, { key: 'f', ctrlKey: true });
    expect(h.c().findOpen).toBe('find');
    key(h, { key: 'h', ctrlKey: true });
    expect(h.c().findOpen).toBe('replace');
    const viewer = await mountGrid({ canEdit: false });
    fireEvent.keyDown(viewer.grid, { key: 'h', ctrlKey: true });
    expect(viewer.c().findOpen).toBe('find');
  });

  it('the menu key opens the cell menu under the active cell', async () => {
    const h = await mountGrid();
    h.grid.getBoundingClientRect = () => ({ left: 10, top: 20 }) as DOMRect;
    select(h, 1, 2);
    key(h, { key: 'ContextMenu' });
    expect(h.c().menu).toEqual({ kind: 'cell', x: 10 + 46 + 200, y: 20 + 22 + 24 + 24 });
  });
});

describe('Escape', () => {
  it('drops the marquee, then closes Find, then leaves the grid for the canvas', async () => {
    const selectElement = vi.fn();
    const h = await mountGrid({ bridge: { selectElement } });
    act(() => {
      h.c().setMarquee({ range: { r1: 0, c1: 0, r2: 0, c2: 0 }, cut: false });
      h.c().setFindOpen('find');
    });
    expect(h.grid.hasAttribute('data-keeps-escape')).toBe(true);
    key(h, { key: 'Escape' });
    expect(h.c().marquee).toBeNull();
    expect(h.c().findOpen).toBe('find');
    expect(h.grid.hasAttribute('data-keeps-escape')).toBe(true);
    key(h, { key: 'Escape' });
    expect(h.c().findOpen).toBeNull();
    expect(h.grid.hasAttribute('data-keeps-escape')).toBe(false);
    h.grid.focus();
    key(h, { key: 'Escape' });
    expect(selectElement).toHaveBeenCalledWith('el1');
    expect(document.activeElement).not.toBe(h.grid);
  });

  it('keeps Escape from the canvas while a cell is edited', async () => {
    const h = await mountGrid();
    act(() => h.c().setEditing({ r: 0, c: 0, draft: '', origin: 'cell' }));
    expect(h.grid.hasAttribute('data-keeps-escape')).toBe(true);
  });

  it('restores a maximised sheet', async () => {
    const selectElement = vi.fn();
    const h = await mountGrid({ maximised: true, bridge: { selectElement } });
    key(h, { key: 'Escape' });
    expect(restorePlanElement).toHaveBeenCalled();
    expect(selectElement).not.toHaveBeenCalled();
  });

  it('leaves the grid without a bridge', async () => {
    const h = await mountGrid({ bridge: null });
    expect(() => key(h, { key: 'Escape' })).not.toThrow();
  });
});

describe('hidden lines', () => {
  it('the arrow between their neighbours shows them again', async () => {
    const h = await mountGrid({ layout: { hiddenCols: ['col2'] } });
    fireEvent.click(screen.getByRole('button', { name: 'Show Column C' }));
    expect(h.called('hide')).toEqual([['c', false, 2, 2]]);
    expect(h.c().sheet.layout.hiddenCols ?? []).toEqual([]);
  });

  it('offers no arrow to someone who may only look', async () => {
    await mountGrid({ canEdit: false, layout: { hiddenCols: ['col2'] } });
    expect(screen.queryByRole('button', { name: 'Show Column C' })).toBeNull();
  });
});

describe('Add Rows', () => {
  it('shows below the last row when it is in view, and adds the rows', async () => {
    const h = await mountGrid({ rows: 5 });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(h.called('appendRows')).toEqual([[100]]);
    expect(h.c().sheet.layout.rows).toHaveLength(105);
  });

  it('is not shown while the last row is out of view, nor to a viewer', async () => {
    await mountGrid({ rows: 100 });
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    await mountGrid({ rows: 5, canEdit: false });
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
  });
});

describe('the error tooltip', () => {
  it('says why the cell under the pointer is an error', async () => {
    const h = await mountGrid({ cells: { A1: 'fine', D1: '=1/0' } });
    fireEvent.pointerMove(h.viewport, cellPoint(0, 3));
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toBe('Division by zero');
    expect(tip.style.left).toBe(`${46 + 300}px`);
    fireEvent.pointerMove(h.viewport, cellPoint(0, 0));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('outlines over the cells', () => {
  const dashed = (h: Mounted) =>
    [...h.container.querySelectorAll<HTMLElement>('div')].filter((el) =>
      el.style.border.includes('dashed'),
    );

  it('rings the references of a formula being written (on this sheet only)', async () => {
    const h = await mountGrid();
    act(() => h.c().setEditing({ r: 5, c: 0, draft: '=A1+B2:C3+Other!D4', origin: 'type' }));
    expect(dashed(h)).toHaveLength(2);
  });

  it('draws each peer’s selection in their colour, named by their full name', async () => {
    const peers = [{ id: 'p1', name: 'Ada Lovelace', color: '#e11d48' }];
    const h = await mountGrid({ peers });
    const presence = sheetPresenceFor(h.store);
    act(() => {
      presence.receive('p1', {
        kind: 'sheet-presence',
        tabId: 't1',
        sheetId: h.sheetId,
        ranges: [
          { r1: 'row1', c1: 'col1', r2: 'row2', c2: 'col2' },
          { r1: 'row5', c1: 'col5', r2: 'row5', c2: 'col5' },
          { r1: 'gone', c1: 'col1', r2: 'row2', c2: 'col2' },
        ],
        editing: true,
      });
      // Someone not in the room's list is not drawn.
      presence.receive('ghost', {
        kind: 'sheet-presence',
        tabId: 't1',
        sheetId: h.sheetId,
        ranges: [{ r1: 'row8', c1: 'col8', r2: 'row8', c2: 'col8' }],
        editing: false,
      });
    });
    expect(screen.getAllByText('Ada Lovelace')).toHaveLength(1);
    const thick = [...h.container.querySelectorAll<HTMLElement>('div')].filter((el) =>
      el.style.border.startsWith('3px'),
    );
    expect(thick).toHaveLength(2);
    // Hovering their range keeps the tag.
    fireEvent.pointerMove(h.viewport, cellPoint(1, 1));
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    fireEvent.pointerMove(h.viewport, cellPoint(9, 9));
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
  });

  it('highlights Find’s matches in view', async () => {
    const h = await mountGrid({ rows: 200 });
    const before = h.container.querySelectorAll('div').length;
    act(() =>
      h.c().setFindHits([
        { r: 0, c: 0 },
        { r: 150, c: 0 },
      ]),
    );
    expect(h.container.querySelectorAll('div').length).toBe(before + 1);
  });

  it('puts the filter’s buttons on its header row, opening the filter menu', async () => {
    const h = await mountGrid({
      layout: {
        filter: {
          r1: 'row0',
          c1: 'col0',
          r2: 'row5',
          c2: 'col1',
          conds: { col1: { op: 'notEmpty' } },
        },
      },
    });
    const buttons = screen.getAllByRole('button', { name: /^Filter column/ });
    expect(buttons).toHaveLength(2);
    buttons[1]!.getBoundingClientRect = () => ({ left: 5, bottom: 7 }) as DOMRect;
    fireEvent.click(buttons[1]!);
    expect(h.c().menu).toEqual({ kind: 'filter', colId: 'col1', x: 5, y: 9 });
  });
});

describe('the wheel', () => {
  const wheel = (h: Mounted, init: WheelEventInit) => {
    const outside = vi.fn();
    h.grid.parentElement!.addEventListener('wheel', outside);
    h.grid.dispatchEvent(new WheelEvent('wheel', { bubbles: true, ...init }));
    h.grid.parentElement!.removeEventListener('wheel', outside);
    return outside.mock.calls.length > 0;
  };

  it('scrolls the grid, not the canvas, while the grid can scroll that way', async () => {
    const h = await mountGrid({ rows: 100, cols: 30 });
    Object.defineProperty(h.grid, 'scrollHeight', { configurable: true, value: 2400 });
    Object.defineProperty(h.grid, 'scrollWidth', { configurable: true, value: 3000 });
    expect(wheel(h, { deltaY: 10 })).toBe(false);
    expect(wheel(h, { deltaX: 10 })).toBe(false);
    // Pinch-zoom (Ctrl+wheel) is the canvas's.
    expect(wheel(h, { deltaY: 10, ctrlKey: true })).toBe(true);
  });

  it('lets the canvas have the wheel when the grid cannot scroll, or outside Plan mode', async () => {
    const h = await mountGrid({ rows: 3, cols: 2 });
    expect(wheel(h, { deltaY: 10 })).toBe(true);
    const still = await mountGrid({ interactive: false });
    Object.defineProperty(still.grid, 'scrollHeight', { configurable: true, value: 2400 });
    expect(wheel(still, { deltaY: 10 })).toBe(true);
  });
});

describe('presence', () => {
  it('says this person’s selection to the room, and nothing once the grid is gone', async () => {
    const h = await mountGrid();
    const sent: unknown[] = [];
    const presence = sheetPresenceFor(h.store);
    presence.connect((op) => sent.push(op));
    select(h, 2, 3);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    expect(sent.at(-1)).toMatchObject({
      sheetId: h.sheetId,
      ranges: [{ r1: 'row2', c1: 'col3', r2: 'row2', c2: 'col3' }],
      editing: false,
    });
    h.unmount();
    await new Promise((r) => setTimeout(r, 200));
    expect(sent.at(-1)).toMatchObject({ ranges: null });
  });
});
