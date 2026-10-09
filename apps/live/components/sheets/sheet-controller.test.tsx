// @vitest-environment jsdom
// One Sheet's working state (docs/specs/029-sheets/sheet.md "The grid", "Selection", "Editing"): the write every
// command goes through (counted, and marking this person's own layout changes so their selection stays), the
// selection as last set for handlers, the selection kept across remounts within the grid's bounds, the Tab run,
// handing focus back to the grid, and rows a filter hides drawn at no height.
import { act, render, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyLayout,
  single,
  type SheetJson,
  type SheetLayout,
  type SheetWrite,
} from '@livediagram/sheets';
import { track } from '@/lib/telemetry';
import type { PlanPalette } from '@/components/plan/plan-palette';
import { SheetStore } from './sheet-store-client';
import {
  SheetControllerProvider,
  useSheetController,
  useSheetControllerState,
} from './sheet-controller';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const by = { id: 'me', name: 'Me', color: '#000000' };
let seq = 5;
const rand = () => ((seq = (seq * 16807) % 2147483647) - 1) / 2147483646;
const palette = new Proxy({}, { get: () => '#000000' }) as PlanPalette;
let idSeq = 0;

async function makeStore(over: Partial<SheetJson> = {}) {
  const json: SheetJson = {
    id: `sheetC${String(idSeq++).padStart(4, '0')}`,
    tabId: 't1',
    title: 'Sheet 1',
    layout: emptyLayout(rand, 6, 4),
    cells: [],
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: by,
    ...over,
  };
  const toast = vi.fn();
  const store = new SheetStore({
    scope: { documentId: 'd1', ownerId: 'o', shareCode: null, tabId: null },
    self: () => by,
    locale: 'en-GB',
    pushUndo: () => {},
    toast,
    api: {
      fetchSheets: async () => [json],
      writeSheet: () => new Promise(() => {}),
    } as never,
  });
  await store.loadTab('t1');
  return { store, id: json.id, toast };
}

function mount(store: SheetStore, id: string) {
  return renderHook(() =>
    useSheetControllerState({
      store,
      sheet: store.sheet(id)!,
      workbook: store.workbook('t1'),
      version: store.version,
      palette,
      interactive: true,
      canEdit: true,
      maximised: false,
      locale: 'en-GB',
      announce: () => {},
      toast: () => {},
      notify: () => {},
    }),
  );
}

beforeEach(() => vi.clearAllMocks());

describe('write', () => {
  it('sends the write and counts it by kind', async () => {
    const { store, id } = await makeStore();
    const view = mount(store, id);
    const { rows, cols } = store.sheet(id)!.layout;
    const w: SheetWrite = { kind: 'cells', cells: [{ r: rows[0]!, c: cols[0]!, i: { n: 3 } }] };
    expect(view.result.current.write(w, 'Cell')).toBe(true);
    expect(store.workbook('t1').value(id, 0, 0)).toBe(3);
    expect(track).toHaveBeenCalledWith('Sheet', 'Changed', 'Cell');
  });

  it('is false, uncounted, when the store refuses it', async () => {
    const { store, id, toast } = await makeStore();
    const view = mount(store, id);
    const { rows, cols } = store.sheet(id)!.layout;
    const w: SheetWrite = {
      kind: 'cells',
      cells: [{ r: rows[0]!, c: cols[0]!, i: { s: 'x'.repeat(10_001) } }],
    };
    expect(view.result.current.write(w, 'Cell')).toBe(false);
    expect(track).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('A cell holds up to 10,000 characters');
  });

  it("keeps this person's selection where it is over their own layout change, and moves it for someone else's", async () => {
    const { store, id } = await makeStore();
    const view = mount(store, id);
    act(() => view.result.current.setSelection(single({ r: 2, c: 1 })));
    // This person inserts a row above: the selection stays at row 3.
    act(() => {
      view.result.current.write(
        { kind: 'layout', changes: [{ k: 'insertRows', after: null, ids: ['own1'] }] },
        'Rows',
      );
    });
    view.rerender();
    expect(view.result.current.selection.active).toEqual({ r: 2, c: 1 });
    // Someone else inserts a row above: the selected row moves down with its id.
    act(() => {
      store.write(id, {
        kind: 'layout',
        changes: [{ k: 'insertRows', after: null, ids: ['peer1'] }],
      });
    });
    view.rerender();
    expect(view.result.current.selection.active).toEqual({ r: 3, c: 1 });
  });
});

describe('the selection', () => {
  it('reads as last set before it renders', async () => {
    const { store, id } = await makeStore();
    const view = mount(store, id);
    const stale = view.result.current;
    stale.setSelection(single({ r: 4, c: 2 }));
    expect(stale.selectionNow().active).toEqual({ r: 4, c: 2 });
    expect(stale.selection.active).toEqual({ r: 0, c: 0 });
    view.rerender();
    expect(view.result.current.selection.active).toEqual({ r: 4, c: 2 });
  });

  it('is kept for the sheet across a remount', async () => {
    const { store, id } = await makeStore();
    const first = mount(store, id);
    act(() => first.result.current.setSelection(single({ r: 3, c: 3 })));
    first.unmount();
    const second = mount(store, id);
    expect(second.result.current.selection.active).toEqual({ r: 3, c: 3 });
  });

  it('starts at A1 again when the sheet shrank under the kept selection', async () => {
    const { store, id } = await makeStore();
    const first = mount(store, id);
    act(() => first.result.current.setSelection(single({ r: 5, c: 3 })));
    first.unmount();
    const layout: SheetLayout = store.sheet(id)!.layout;
    store.write(id, {
      kind: 'layout',
      changes: [{ k: 'deleteRows', ids: layout.rows.slice(4) }],
    });
    const second = mount(store, id);
    expect(second.result.current.selection.active).toEqual({ r: 0, c: 0 });
  });

  it('starts at A1 for a sheet seen for the first time', async () => {
    const { store, id } = await makeStore();
    expect(mount(store, id).result.current.selection).toEqual(single({ r: 0, c: 0 }));
  });
});

describe('the Tab run and focus', () => {
  it('holds where a run of Tabs began until cleared', async () => {
    const { store, id } = await makeStore();
    const { result } = mount(store, id);
    expect(result.current.tabRun()).toBeNull();
    result.current.setTabRun({ r: 1, c: 2 });
    expect(result.current.tabRun()).toEqual({ r: 1, c: 2 });
    result.current.setTabRun(null);
    expect(result.current.tabRun()).toBeNull();
  });

  it('hands focus back to the grid frame, without scrolling', async () => {
    const { store, id } = await makeStore();
    const view = mount(store, id);
    expect(() => view.result.current.focusGrid()).not.toThrow();
    const el = document.createElement('div');
    el.tabIndex = 0;
    document.body.appendChild(el);
    const focus = vi.spyOn(el, 'focus');
    act(() => view.result.current.setGridEl(el));
    view.result.current.focusGrid();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    el.remove();
  });
});

describe('geometry and grid', () => {
  it('draws rows the filter hides at no height', async () => {
    const layout = emptyLayout(rand, 5, 2);
    const [r0, r1, r2, r3] = layout.rows as [string, string, string, string];
    const c0 = layout.cols[0]!;
    const { store, id } = await makeStore({
      layout: {
        ...layout,
        filter: { r1: r0, c1: c0, r2: r3, c2: c0, conds: { [c0]: { values: ['keep'] } } },
      },
      cells: [
        { r: r0, c: c0, i: { s: 'Head' } },
        { r: r1, c: c0, i: { s: 'keep' } },
        { r: r2, c: c0, i: { s: 'drop' } },
        { r: r3, c: c0, i: { s: 'keep' } },
      ],
    });
    const { result } = mount(store, id);
    const hidden = [0, 1, 2, 3, 4].map((r) => result.current.geometry.hiddenRow(r));
    expect(hidden).toEqual([false, false, true, false, false]);
    expect(result.current.grid.hiddenRow(2)).toBe(true);
    expect(result.current.geometry.rows[3]! - result.current.geometry.rows[2]!).toBe(0);
  });

  it('says which cells are filled, and the grid size', async () => {
    const layout = emptyLayout(rand, 3, 3);
    const { store, id } = await makeStore({
      layout,
      cells: [
        { r: layout.rows[1]!, c: layout.cols[1]!, i: { n: 1 } },
        { r: layout.rows[2]!, c: layout.cols[2]!, i: { s: '' } },
      ],
    });
    const { grid } = mount(store, id).result.current;
    expect([grid.rows, grid.cols]).toEqual([3, 3]);
    expect([grid.filled(1, 1), grid.filled(0, 0), grid.filled(2, 2)]).toEqual([true, false, false]);
    expect(grid.mergeAt(0, 0)).toBeNull();
  });
});

describe('useSheetController', () => {
  it('throws outside a Sheet, and reads the provided controller inside one', async () => {
    const { store, id } = await makeStore();
    const { result } = mount(store, id);
    function Probe() {
      useSheetController();
      return null;
    }
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useSheetController outside a Sheet');
    let seen: unknown = null;
    function Reader() {
      seen = useSheetController();
      return null;
    }
    render(
      <SheetControllerProvider value={result.current}>
        <Reader />
      </SheetControllerProvider>,
    );
    expect(seen).toBe(result.current);
  });
});
