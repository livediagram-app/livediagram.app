// A Sheet's working parts over a real store with a fake api, for the component tests of the toolbar, menus,
// header, find bar, formula bar and cell editor: the controller is the real one, the actions are the real ones,
// and every write lands in the store's view at once (and in `writes` once the queue has sent it).
import { act, render, type RenderResult } from '@testing-library/react';
import { useSyncExternalStore, type ReactNode } from 'react';
import { vi, type Mock } from 'vitest';
import {
  cellKey,
  emptyLayout,
  parseRangeText,
  sheetFromJson,
  sheetToJson,
  typeInto,
  type CellFormat,
  type GridRange,
  type Sheet,
  type SheetJson,
  type SheetWrite,
} from '@livediagram/sheets';
import { planPalette } from '@/components/plan/plan-palette';
import { SheetStore } from './sheet-store-client';
import {
  SheetControllerProvider,
  useSheetController,
  useSheetControllerState,
  type SheetController,
} from './sheet-controller';
import { useSheetActions, type SheetActions } from './useSheetActions';
import { useFormulaInput, type FormulaInput } from './useFormulaInput';

export const SHEET_ID = 'sheet0001';
const by = { id: 'me', name: 'Me', color: '#000000' };

function sheetJson(id: string, title: string, rows: number, cols: number): SheetJson {
  let seq = 7;
  const rand = () => ((seq = (seq * 16807) % 2147483647) - 1) / 2147483646;
  return {
    id,
    tabId: 't1',
    title,
    layout: emptyLayout(rand, rows, cols),
    cells: [],
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: by,
  };
}

export type SheetHarness = {
  store: SheetStore;
  writes: SheetWrite[];
  toast: Mock<(m: string) => void>;
  placeChart: Mock<(kind: string, range: unknown) => void>;
  // What the controller hands each local write to (a card table's push sets it).
  push: { current: ((before: Sheet, write: SheetWrite) => void) | null };
  setPush: (push: ((before: Sheet, write: SheetWrite) => void) | null) => void;
  notify: Mock<(m: string) => void>;
  announce: Mock<(m: string) => void>;
  // The controller as last rendered.
  ctl: () => SheetController;
  // A cell's stored input and format, by A1.
  cell: (a1: string) => { input?: unknown; format?: CellFormat } | undefined;
  value: (a1: string) => unknown;
  select: (a1: string, active?: string) => void;
  // Called by the rendered root with each render's controller.
  attach: (c: SheetController) => void;
};

export async function makeSheet(
  opts: {
    rows?: number;
    cols?: number;
    cells?: Record<string, string>;
    format?: Record<string, CellFormat>;
    otherTitles?: string[];
  } = {},
): Promise<SheetHarness> {
  const writes: SheetWrite[] = [];
  const toast = vi.fn<(m: string) => void>();
  const notify = vi.fn<(m: string) => void>();
  const announce = vi.fn<(m: string) => void>();
  const sheets = [
    sheetJson(SHEET_ID, 'Sheet 1', opts.rows ?? 8, opts.cols ?? 5),
    ...(opts.otherTitles ?? []).map((t, i) => sheetJson(`other000${i}`, t, 2, 2)),
  ];
  const store = new SheetStore({
    scope: { documentId: 'd1', ownerId: 'o', shareCode: null, tabId: null },
    self: () => by,
    locale: 'en-GB',
    pushUndo: () => {},
    toast,
    api: {
      fetchSheets: async () => sheets.map((s) => sheetToJson(sheetFromJson(s))),
      writeSheet: async (_s: unknown, _id: string, req: { write: SheetWrite }) => {
        writes.push(req.write);
        return { rev: 0, applied: req.write };
      },
    } as never,
  });
  await store.loadTab('t1');
  const pos = (a1: string) => {
    const g = parseRangeText(a1)!;
    return { r: g.r1, c: g.c1 };
  };
  const ids = (a1: string) => {
    const p = pos(a1);
    const layout = store.sheet(SHEET_ID)!.layout;
    return { r: layout.rows[p.r]!, c: layout.cols[p.c]! };
  };
  for (const [a1, text] of Object.entries(opts.cells ?? {})) {
    const res = typeInto(store.workbook('t1'), SHEET_ID, pos(a1), text);
    if (!res?.ok) throw new Error(`could not seed ${a1}`);
    store.write(SHEET_ID, res.write);
  }
  for (const [a1, f] of Object.entries(opts.format ?? {})) {
    const { r, c } = ids(a1);
    store.write(SHEET_ID, { kind: 'cells', cells: [{ r, c, f }] });
  }
  await store.settle();
  writes.length = 0;
  let current: SheetController | null = null;
  const h: SheetHarness = {
    store,
    writes,
    toast,
    placeChart: vi.fn(),
    push: { current: null },
    setPush: (push) => {
      h.push.current = push;
    },
    notify,
    announce,
    ctl: () => current!,
    cell: (a1) => {
      const { r, c } = ids(a1);
      return store.sheet(SHEET_ID)!.cells.get(cellKey(r, c));
    },
    value: (a1) => {
      const p = pos(a1);
      return store.workbook('t1').value(SHEET_ID, p.r, p.c);
    },
    select: (a1, active) => {
      const g = parseRangeText(a1) as GridRange;
      const at = active ? pos(active) : { r: g.r1, c: g.c1 };
      current!.setSelection({ ranges: [g], active: at, anchor: at });
    },
    attach: (c) => {
      current = c;
    },
  };
  return h;
}

export type SheetParts = { c: SheetController; actions: SheetActions; input: FormulaInput };

function Parts({ ui }: { ui: (p: SheetParts) => ReactNode }) {
  const c = useSheetController();
  const actions = useSheetActions();
  const input = useFormulaInput(actions);
  return <>{ui({ c, actions, input })}</>;
}

function Root({
  h,
  ui,
  canEdit,
  interactive,
  maximised,
}: {
  h: SheetHarness;
  ui: (p: SheetParts) => ReactNode;
  canEdit: boolean;
  interactive: boolean;
  maximised: boolean;
}) {
  const version = useSyncExternalStore(h.store.subscribe, h.store.getVersion);
  const c = useSheetControllerState({
    store: h.store,
    sheet: h.store.sheet(SHEET_ID)!,
    workbook: h.store.workbook('t1'),
    version,
    palette: planPalette('light'),
    interactive,
    canEdit,
    maximised,
    locale: 'en-GB',
    announce: h.announce,
    toast: h.toast,
    placeChart: h.placeChart,
    notify: h.notify,
    onWrote: (before, write) => h.push.current?.(before, write),
  });
  h.attach(c);
  return (
    <SheetControllerProvider value={c}>
      <Parts ui={ui} />
    </SheetControllerProvider>
  );
}

export function renderSheet(
  h: SheetHarness,
  ui: (p: SheetParts) => ReactNode,
  opts: { canEdit?: boolean; interactive?: boolean; maximised?: boolean; at?: string } = {},
): RenderResult {
  const view = render(
    <Root
      h={h}
      ui={ui}
      canEdit={opts.canEdit ?? true}
      interactive={opts.interactive ?? true}
      maximised={opts.maximised ?? false}
    />,
  );
  // The selection outlives a Sheet's tree for the session (sheet-controller's kept selections): start each test
  // from a known cell.
  act(() => h.select(opts.at ?? 'A1'));
  return view;
}

// jsdom has no ResizeObserver; the toolbar, menus and context menus measure with one.
export function stubResizeObserver(): void {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
