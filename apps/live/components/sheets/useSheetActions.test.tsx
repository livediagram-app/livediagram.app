// @vitest-environment jsdom
// The Sheet's actions over a live controller (blueprint sheet-element.md "Editor components"): commands read the
// selection as last set (not the render's copy), and Enter after a run of Tabs returns to the run's first column.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cellKey,
  emptyLayout,
  sheetFromJson,
  sheetToJson,
  single,
  type SheetJson,
  type SheetWrite,
} from '@livediagram/sheets';
import { SheetStore } from './sheet-store-client';
import { useSheetControllerState } from './sheet-controller';
import { useSheetActions } from './useSheetActions';
import type { PlanPalette } from '@/components/plan/plan-palette';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
import { track } from '@/lib/telemetry';

const by = { id: 'me', name: 'Me', color: '#000000' };
let seq = 7;
const rand = () => ((seq = (seq * 16807) % 2147483647) - 1) / 2147483646;
const json = (): SheetJson => ({
  id: 'sheet0001',
  tabId: 't1',
  title: 'Sheet 1',
  layout: emptyLayout(rand, 6, 4),
  cells: [],
  rev: 0,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: by,
});
const palette = new Proxy({}, { get: () => '#000000' }) as PlanPalette;

async function harness() {
  const initial = json();
  const writes: SheetWrite[] = [];
  const store = new SheetStore({
    scope: { documentId: 'd1', ownerId: 'o', shareCode: null, tabId: null },
    self: () => by,
    locale: 'en-GB',
    pushUndo: () => {},
    toast: () => {},
    api: {
      fetchSheets: async () => [sheetToJson(sheetFromJson(initial))],
      writeSheet: (_s: unknown, _id: string, req: { write: SheetWrite }) => {
        writes.push(req.write);
        return new Promise(() => {});
      },
    } as never,
  });
  await store.loadTab('t1');
  const view = renderHook(() => {
    const c = useSheetControllerState({
      store,
      sheet: store.sheet('sheet0001')!,
      workbook: store.workbook('t1'),
      version: 0,
      palette,
      interactive: true,
      canEdit: true,
      maximised: false,
      locale: 'en-GB',
      announce: () => {},
      toast: () => {},
      notify: () => {},
    });
    current = c;
    return { c, actions: useSheetActions() };
  });
  return { view, writes, layout: initial.layout, store };
}

// useSheetActions reads the controller from context; here it is the hook's own, handed over directly.
let current: ReturnType<typeof useSheetControllerState> | null = null;
vi.mock('./sheet-controller', async (orig) => {
  const real = await orig<typeof import('./sheet-controller')>();
  return { ...real, useSheetController: () => current! };
});
describe('the sheet actions', () => {
  beforeEach(() => {
    current = null;
  });

  it('format the selection as last set, even before it has rendered', async () => {
    const { view, writes, layout } = await harness();
    const stale = view.result.current;
    act(() => {
      // A drag's last move sets A1:A3; a key arrives before that render, through the previous render's actions.
      stale.c.setSelection({
        ranges: [{ r1: 0, c1: 0, r2: 2, c2: 0 }],
        active: { r: 0, c: 0 },
        anchor: { r: 0, c: 0 },
      });
      stale.actions.toggle('b');
    });
    await new Promise((r) => setTimeout(r, 0));
    const cells = writes.flatMap((w) => (w.kind === 'cells' ? w.cells : []));
    expect(cells.map((x) => cellKey(x.r, x.c))).toEqual(
      [0, 1, 2].map((r) => cellKey(layout.rows[r]!, layout.cols[0]!)),
    );
  });

  it('returns Enter to the column a run of Tabs began in', async () => {
    const { view } = await harness();
    const type = (text: string, move: 'right' | 'down') => {
      act(() => view.result.current.actions.startEdit('type', text));
      act(() => {
        view.result.current.actions.commitEdit(move);
      });
    };
    act(() => view.result.current.actions.goTo({ r1: 0, c1: 1, r2: 0, c2: 1 }));
    type('a', 'right');
    type('b', 'right');
    type('c', 'down');
    expect(view.result.current.c.selection.active).toEqual({ r: 1, c: 1 });
    // A move in between ends the run: Enter then goes straight down.
    type('d', 'right');
    act(() => view.result.current.actions.move('right'));
    type('e', 'down');
    expect(view.result.current.c.selection.active).toEqual({ r: 2, c: 3 });
  });
});

// ---- Every command, over a real store --------------------------------------------------------------------

async function rich(opts: { canEdit?: boolean; rows?: number; cols?: number } = {}) {
  const pending = () => new Promise<never>(() => {});
  const initial = { ...json(), layout: emptyLayout(rand, opts.rows ?? 6, opts.cols ?? 4) };
  const announce = vi.fn();
  const store = new SheetStore({
    scope: { documentId: 'd1', ownerId: 'o', shareCode: null, tabId: null },
    self: () => by,
    locale: 'en-GB',
    pushUndo: () => {},
    toast: () => {},
    api: {
      fetchSheets: async () => [initial],
      writeSheet: pending,
      createSheet: pending,
    } as never,
  });
  await store.loadTab('t1');
  const view = renderHook(() => {
    const c = useSheetControllerState({
      store,
      sheet: store.sheet(ID)!,
      workbook: store.workbook('t1'),
      version: store.version,
      palette,
      interactive: true,
      canEdit: opts.canEdit ?? true,
      maximised: false,
      locale: 'en-GB',
      announce,
      toast: () => {},
      notify: () => {},
    });
    current = c;
    return { c, actions: useSheetActions() };
  });
  // The same sheet id throughout, whose selection is kept for the session: start at A1.
  act(() => view.result.current.c.setSelection(single({ r: 0, c: 0 })));
  const run = (f: (a: ReturnType<typeof useSheetActions>) => unknown) => {
    let out: unknown;
    act(() => {
      out = f(view.result.current.actions);
    });
    view.rerender();
    return out;
  };
  const select = (r1: number, c1: number, r2 = r1, c2 = c1) =>
    run((a) => a.goTo({ r1, c1, r2, c2 }));
  const sheet = () => store.sheet(ID)!;
  const cell = (r: number, col: number) =>
    sheet().cells.get(cellKey(sheet().layout.rows[r]!, sheet().layout.cols[col]!));
  const value = (r: number, col: number) => store.workbook('t1').value(ID, r, col);
  const typeAt = (r: number, col: number, text: string) => {
    select(r, col);
    run((a) => a.startEdit('type', text));
    return run((a) => a.commitEdit('none')) as { ok: boolean };
  };
  return { store, view, run, select, sheet, cell, value, typeAt, announce };
}

const ID = 'sheet0001';

describe('editing', () => {
  beforeEach(() => vi.mocked(track).mockClear());

  it('starts an edit from the input as typed, and does nothing on a read-only Sheet', async () => {
    const h = await rich();
    h.typeAt(0, 0, '=1+2');
    h.run((a) => a.startEdit('cell'));
    expect(h.view.result.current.c.editing).toEqual({ r: 0, c: 0, origin: 'cell', draft: '=1+2' });
    h.run((a) => a.cancelEdit());
    expect(h.view.result.current.c.editing).toBeNull();
    const ro = await rich({ canEdit: false });
    ro.run((a) => a.startEdit('type', 'x'));
    expect(ro.view.result.current.c.editing).toBeNull();
  });

  it('commits nothing with no edit open', async () => {
    const h = await rich();
    expect(h.run((a) => a.commitEdit('down'))).toEqual({ ok: true });
  });

  it('refuses a formula it cannot read, keeping the edit open', async () => {
    const h = await rich();
    h.run((a) => a.startEdit('type', '=1+'));
    const out = h.run((a) => a.commitEdit('down')) as { ok: false; message: string };
    expect(out.ok).toBe(false);
    expect(out.message).toEqual(expect.any(String));
    expect(h.view.result.current.c.editing).not.toBeNull();
  });

  it('refuses an input past the cell limit with its own message', async () => {
    const h = await rich();
    h.run((a) => a.startEdit('type', 'x'.repeat(10_001)));
    expect(h.run((a) => a.commitEdit('none'))).toMatchObject({
      ok: false,
      message: 'A cell holds up to 10,000 characters',
    });
  });

  it('counts each function a saved formula uses, and ends the marquee', async () => {
    const h = await rich();
    act(() =>
      h.view.result.current.c.setMarquee({ range: { r1: 0, c1: 0, r2: 0, c2: 0 }, cut: false }),
    );
    h.typeAt(0, 0, '=SUM(1,2)+ABS(-1)');
    expect(h.value(0, 0)).toBe(4);
    expect(track).toHaveBeenCalledWith('Sheet', 'Changed', 'Formula');
    expect(track).toHaveBeenCalledWith('Sheet', 'Used', 'SUM');
    expect(track).toHaveBeenCalledWith('Sheet', 'Used', 'ABS');
    expect(h.view.result.current.c.marquee).toBeNull();
    h.typeAt(1, 0, 'plain');
    expect(track).toHaveBeenCalledWith('Sheet', 'Changed', 'Cell');
  });

  it('types into every selected cell with Ctrl+Enter, staying put', async () => {
    const h = await rich();
    h.select(0, 0, 1, 1);
    h.run((a) => a.startEdit('type', '7'));
    h.run((a) => a.commitEdit('down', true));
    expect([h.value(0, 0), h.value(0, 1), h.value(1, 0), h.value(1, 1)]).toEqual([7, 7, 7, 7]);
    expect(h.view.result.current.c.selection.active).toEqual({ r: 0, c: 0 });
  });
});

describe('moving', () => {
  it('moves, jumps and extends, announcing the cell', async () => {
    const h = await rich();
    h.run((a) => a.move('down'));
    expect(h.view.result.current.c.selection.active).toEqual({ r: 1, c: 0 });
    expect(h.announce).toHaveBeenLastCalledWith('A2');
    h.run((a) => a.move('right', true));
    expect(h.view.result.current.c.selection.active.c).toBe(3);
    h.select(0, 0);
    h.run((a) => a.move('down', false, true));
    expect(h.view.result.current.c.selection.ranges).toEqual([{ r1: 0, c1: 0, r2: 1, c2: 0 }]);
  });
});

describe('clearing and formats', () => {
  it('clears inputs, formats, or both', async () => {
    const h = await rich();
    h.typeAt(0, 0, '1');
    h.run((a) => a.toggle('b'));
    h.run((a) => a.clear('inputs'));
    expect(h.cell(0, 0)).toEqual({ format: { b: true } });
    h.typeAt(0, 0, '2');
    h.run((a) => a.clear('formats'));
    expect(h.cell(0, 0)).toEqual({ input: { n: 2 } });
    h.run((a) => a.toggle('i'));
    h.run((a) => a.clear('all'));
    expect(h.cell(0, 0)).toBeUndefined();
  });

  it('toggles a flag by the active cell, and formats the selection', async () => {
    const h = await rich();
    h.select(0, 0, 0, 1);
    h.run((a) => a.toggle('u'));
    expect([h.cell(0, 0)?.format?.u, h.cell(0, 1)?.format?.u]).toEqual([true, true]);
    expect((h.view.result.current.actions.activeFormat() as { u?: boolean }).u).toBe(true);
    h.run((a) => a.toggle('u'));
    expect(h.cell(0, 0)?.format?.u).toBeUndefined();
    h.run((a) => a.format({ fs: 14 }));
    expect(h.cell(0, 1)?.format?.fs).toBe(14);
  });

  it('sets number formats, a currency, back to automatic, and steps decimals', async () => {
    const h = await rich();
    h.typeAt(0, 0, '1.5');
    h.run((a) => a.numberFormat('currency', '€'));
    expect(h.cell(0, 0)?.format).toMatchObject({ nf: 'currency', cur: '€' });
    h.run((a) => a.numberFormat('auto'));
    expect(h.cell(0, 0)?.format?.nf).toBeUndefined();
    h.run((a) => a.decimals(1));
    expect(h.cell(0, 0)?.format?.dp).toBe(2);
    h.run((a) => a.decimals(-1));
    expect(h.cell(0, 0)?.format?.dp).toBe(1);
    // A text cell steps from no value.
    h.typeAt(1, 0, 'x');
    h.run((a) => a.decimals(1));
    expect(h.cell(1, 0)?.format?.dp).toEqual(expect.any(Number));
  });

  it('sets borders on the primary range', async () => {
    const h = await rich();
    h.select(0, 0, 1, 1);
    h.run((a) => a.borders('outer', { w: 1, s: 'solid', c: '#000000' }));
    expect(h.cell(0, 0)?.format).toBeDefined();
  });

  it('merges, asking first when inputs would be cleared, and unmerges', async () => {
    const h = await rich();
    h.select(0, 0);
    h.run((a) => a.merge('all', () => true));
    expect(h.sheet().layout.merges ?? []).toEqual([]);
    h.typeAt(0, 1, 'lost');
    h.select(0, 0, 0, 1);
    const no = vi.fn(() => false);
    h.run((a) => a.merge('all', no));
    expect(no).toHaveBeenCalled();
    expect(h.sheet().layout.merges ?? []).toEqual([]);
    h.run((a) => a.merge('across', () => true));
    expect(h.sheet().layout.merges).toHaveLength(1);
    h.run((a) => a.unmerge());
    expect(h.sheet().layout.merges ?? []).toEqual([]);
    h.run((a) => a.unmerge());
  });
});

describe('fill', () => {
  it('fills a series or a copy, and from the edge', async () => {
    const h = await rich();
    h.typeAt(0, 0, '1');
    h.typeAt(1, 0, '2');
    h.run((a) => a.fill({ r1: 0, c1: 0, r2: 1, c2: 0 }, { r1: 0, c1: 0, r2: 3, c2: 0 }, false));
    expect(h.value(3, 0)).toBe(4);
    // Ctrl-drag of one number counts (as Sheets does).
    h.run((a) => a.fill({ r1: 0, c1: 0, r2: 0, c2: 0 }, { r1: 0, c1: 0, r2: 0, c2: 2 }, true));
    expect(h.value(0, 2)).toBe(3);
    h.select(0, 0, 0, 3);
    h.run((a) => a.fillEdge('right'));
    expect(h.value(0, 3)).toBe(1);
    h.select(0, 0, 2, 0);
    h.run((a) => a.fillEdge('down'));
    expect(h.value(2, 0)).toBe(1);
  });
});

describe('rows and columns', () => {
  it('inserts lines before and after the selection, announcing them', async () => {
    const h = await rich();
    h.select(1, 1, 2, 1);
    h.run((a) => a.insert('r', 'before'));
    expect(h.sheet().layout.rows).toHaveLength(8);
    expect(h.announce).toHaveBeenLastCalledWith('2 rows inserted');
    h.select(0, 0);
    h.run((a) => a.insert('c', 'after'));
    expect(h.sheet().layout.cols).toHaveLength(5);
    expect(h.announce).toHaveBeenLastCalledWith('1 column inserted');
  });

  it('shifts cells to make room and to close the gap', async () => {
    const h = await rich();
    h.typeAt(0, 0, 'a');
    h.select(0, 0);
    h.run((a) => a.shift('insertDown'));
    expect(h.value(1, 0)).toBe('a');
    h.run((a) => a.shift('deleteUp'));
    expect(h.value(0, 0)).toBe('a');
    // Nothing beyond an empty column to shift.
    h.select(0, 3);
    h.run((a) => a.shift('deleteLeft'));
  });

  it('moves a formula on another sheet that reads shifted cells', async () => {
    const h = await rich();
    h.store.create({
      id: 'sheet0002',
      tabId: 't1',
      title: 'Other',
      layout: emptyLayout(rand, 3, 3),
    });
    h.typeAt(1, 0, '5');
    const { typeInto } = await import('@livediagram/sheets');
    const t = typeInto(h.store.workbook('t1'), 'sheet0002', { r: 0, c: 0 }, "='Sheet 1'!A2");
    if (t?.ok) h.store.write('sheet0002', t.write);
    expect(h.store.workbook('t1').value('sheet0002', 0, 0)).toBe(5);
    h.select(0, 0);
    h.run((a) => a.shift('insertDown'));
    expect(h.store.workbook('t1').value('sheet0002', 0, 0)).toBe(5);
  });

  it('appends rows', async () => {
    const h = await rich();
    h.run((a) => a.appendRows(10));
    expect(h.sheet().layout.rows).toHaveLength(16);
  });

  it('deletes lines and selects where the first one was, or the new last', async () => {
    const h = await rich();
    h.select(4, 1, 5, 1);
    h.run((a) => a.remove('r'));
    expect(h.sheet().layout.rows).toHaveLength(4);
    expect(h.view.result.current.c.selection.active).toEqual({ r: 3, c: 1 });
    h.select(0, 1, 0, 2);
    h.run((a) => a.remove('c'));
    expect(h.sheet().layout.cols).toHaveLength(2);
    expect(h.view.result.current.c.selection.active).toEqual({ r: 0, c: 1 });
    // Every row: one is kept, and the selection is clamped into it.
    h.select(1, 0, 3, 0);
    h.run((a) => a.remove('r'));
    expect(h.view.result.current.c.selection.active).toEqual({ r: 0, c: 0 });
  });

  it('hides and shows lines, from the selection or named ones', async () => {
    const h = await rich();
    h.select(1, 1);
    h.run((a) => a.hide('r', true));
    expect(h.sheet().layout.hiddenRows).toEqual([h.sheet().layout.rows[1]]);
    h.run((a) => a.hide('c', true, 2, 3));
    expect(h.sheet().layout.hiddenCols).toHaveLength(2);
    h.run((a) => a.hide('c', false, 2));
    expect(h.sheet().layout.hiddenCols).toHaveLength(1);
    h.run((a) => a.hide('r', false));
    expect(h.sheet().layout.hiddenRows ?? []).toEqual([]);
  });

  it('resizes, autofits by the widest value, and reads sizes', async () => {
    const h = await rich();
    h.run((a) => a.resize('c', [0], 150));
    expect(h.view.result.current.actions.sizeOf('c', 0)).toBe(150);
    h.run((a) => a.resize('r', [0], 40));
    expect(h.view.result.current.actions.sizeOf('r', 0)).toBe(40);
    h.typeAt(0, 1, 'a fairly long piece of text for a column');
    h.typeAt(1, 1, '=1/0');
    h.run((a) => a.format({ fs: 20 }));
    h.run((a) => a.autofit('c', [1]));
    expect(h.view.result.current.actions.sizeOf('c', 1)).toBeGreaterThan(200);
    h.run((a) => a.autofit('r', [1]));
    expect(h.view.result.current.actions.sizeOf('r', 1)).toBeGreaterThan(24);
    // An empty column falls back to the smallest width.
    h.run((a) => a.autofit('c', [3]));
    expect(h.view.result.current.actions.sizeOf('c', 3)).toBe(24);
  });

  it('moves dragged lines', async () => {
    const h = await rich();
    const first = h.sheet().layout.cols[0];
    h.run((a) => a.moveAxis('c', 0, 0, 3));
    expect(h.sheet().layout.cols.indexOf(first!)).toBe(2);
    const row = h.sheet().layout.rows[4];
    h.run((a) => a.moveAxis('r', 4, 4, 0));
    expect(h.sheet().layout.rows[0]).toBe(row);
  });
});

describe('sort, filter, freeze, dates', () => {
  it('sorts the sheet by the active column, announcing it', async () => {
    const h = await rich();
    h.typeAt(0, 0, '3');
    h.typeAt(1, 0, '1');
    h.typeAt(2, 0, '2');
    h.select(0, 0);
    h.run((a) => a.sortColumn(true));
    expect([h.value(0, 0), h.value(1, 0), h.value(2, 0)]).toEqual([1, 2, 3]);
    expect(h.announce).toHaveBeenLastCalledWith('Sorted A to Z');
    h.run((a) => a.sortColumn(false));
    expect(h.value(0, 0)).toBe(3);
    expect(h.announce).toHaveBeenLastCalledWith('Sorted Z to A');
  });

  it('sorts a range by keys under a header', async () => {
    const h = await rich();
    h.typeAt(0, 0, 'Head');
    h.typeAt(1, 0, 'b');
    h.typeAt(2, 0, 'a');
    h.select(0, 0, 2, 0);
    h.run((a) => a.sortRange([{ col: 0, ascending: true }], true));
    expect([h.value(0, 0), h.value(1, 0), h.value(2, 0)]).toEqual(['Head', 'a', 'b']);
  });

  it('turns a filter on and off, and sets a column condition', async () => {
    const h = await rich();
    h.typeAt(0, 0, 'Head');
    h.typeAt(1, 0, 'x');
    h.select(0, 0, 1, 0);
    h.run((a) => a.toggleFilter());
    expect(h.sheet().layout.filter).toBeDefined();
    const col = h.sheet().layout.cols[0]!;
    h.run((a) => a.setFilter(col, { values: ['x'] }));
    expect(h.sheet().layout.filter?.conds[col]).toEqual({ values: ['x'] });
    h.run((a) => a.toggleFilter());
    expect(h.sheet().layout.filter).toBeUndefined();
  });

  it('freezes within the limits and the grid', async () => {
    const h = await rich();
    h.run((a) => a.freeze(300, 2));
    expect([h.sheet().layout.frozenRows, h.sheet().layout.frozenCols]).toEqual([5, 2]);
    h.run((a) => a.freeze(1));
    expect(h.sheet().layout.frozenRows).toBe(1);
  });

  it("types today's date and the time now", async () => {
    const h = await rich();
    h.run((a) => a.typeNow('date'));
    expect(h.cell(0, 0)?.format?.nf).toBe('date');
    expect(Number.isInteger((h.cell(0, 0)?.input as { n: number }).n)).toBe(true);
    h.select(1, 0);
    h.run((a) => a.typeNow('time'));
    const n = (h.cell(1, 0)?.input as { n: number }).n;
    expect(h.cell(1, 0)?.format?.nf).toBe('time');
    expect(n >= 0 && n < 1).toBe(true);
  });
});
