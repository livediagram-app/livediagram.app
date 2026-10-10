// A live Sheet grid for component tests: a real SheetStore over a fake api, the real controller, the real actions
// (each call logged), a jsdom with the sizes and APIs the grid reads, and a SheetGrid drawn inside its provider.
import { render, within } from '@testing-library/react';
import { useMemo, useSyncExternalStore } from 'react';
import {
  Workbook,
  cellKey,
  parseA1,
  readTypedInput,
  sheetToJson,
  type CellFormat,
  type Sheet,
  type SheetLayout,
  type SheetWrite,
} from '@livediagram/sheets';
import { planPalette } from '@/components/plan/plan-palette';
import {
  SheetsBridgeContext,
  type SheetsBridge,
  type SheetPeer,
} from '@/hooks/sheets/useSheetsBridge';
import { SheetStore } from './sheet-store-client';
import {
  SheetControllerProvider,
  useSheetControllerState,
  type SheetController,
} from './sheet-controller';
import { useSheetActions, type SheetActions } from './useSheetActions';
import { useFormulaInput } from './useFormulaInput';
import { SheetGrid } from './SheetGrid';
import type { PointRef } from './useSheetPointer';
import { COL_HEADER_PX, ROW_HEADER_PX } from './sheet-geometry';

export const VIEW = { width: 800, height: 400 };
// A fresh sheet id per mount: the controller keeps each sheet's last selection for the session.
let seq = 0;
export const TAB_ID = 't1';

// Axis ids as the engine accepts them (4 to 12 lowercase letters and digits): row0.., col0...
export function gridLayout(rows: number, cols: number, extra: Partial<SheetLayout> = {}) {
  return {
    rows: Array.from({ length: rows }, (_, i) => `row${i}`),
    cols: Array.from({ length: cols }, (_, i) => `col${i}`),
    ...extra,
    // Fixed sizes (100 x 24), so the arithmetic below tests the geometry, not the engine's defaults.
    rowSize: {
      ...Object.fromEntries(Array.from({ length: rows }, (_, i) => [`row${i}`, 24])),
      ...extra.rowSize,
    },
    colSize: {
      ...Object.fromEntries(Array.from({ length: cols }, (_, i) => [`col${i}`, 100])),
      ...extra.colSize,
    },
  } satisfies SheetLayout;
}

// What jsdom lacks: a size for the grid's frame, ResizeObserver, and element scrolling (recorded).
export function installGridDom(): () => void {
  const scrolls: [string, unknown][] = [];
  const proto = HTMLDivElement.prototype as unknown as Record<string, unknown>;
  Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute('data-sheet-grid') ? VIEW.width : 0;
    },
  });
  Object.defineProperty(HTMLDivElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute('data-sheet-grid') ? VIEW.height : 0;
    },
  });
  proto.scrollTo = function (this: HTMLElement, opts: unknown) {
    scrolls.push(['to', opts]);
  };
  proto.scrollBy = function (this: HTMLElement, opts: unknown) {
    scrolls.push(['by', opts]);
  };
  const g = globalThis as unknown as { ResizeObserver?: unknown };
  const hadRO = g.ResizeObserver;
  g.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
  gridScrolls = scrolls;
  return () => {
    delete proto.clientWidth;
    delete proto.clientHeight;
    delete proto.scrollTo;
    delete proto.scrollBy;
    g.ResizeObserver = hadRO;
  };
}

export let gridScrolls: [string, unknown][] = [];

export type ActionCall = [keyof SheetActions, unknown[]];

export type MountOptions = {
  rows?: number;
  cols?: number;
  layout?: Partial<SheetLayout>;
  cells?: Record<string, string>;
  formats?: Record<string, CellFormat>;
  canEdit?: boolean;
  interactive?: boolean;
  maximised?: boolean;
  peers?: readonly SheetPeer[];
  pointRef?: PointRef;
  bridge?: Partial<SheetsBridge> | null;
  title?: string;
  // The covering Sheet's zoom (sheet-zoom.ts).
  zoom?: number;
};

function initialSheet(id: string, o: MountOptions): Sheet {
  const layout = gridLayout(o.rows ?? 30, o.cols ?? 10, o.layout);
  const sheet: Sheet = {
    id,
    tabId: TAB_ID,
    title: o.title ?? 'Sheet 1',
    layout,
    cells: new Map(),
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: { id: 'me', name: 'Me', color: '#000000' },
  };
  const typing = new Workbook({ sheets: [sheet], locale: 'en-GB' });
  const key = (a1: string) => {
    const p = parseA1(a1)!;
    return cellKey(layout.rows[p.r]!, layout.cols[p.c]!);
  };
  for (const [a1, text] of Object.entries(o.cells ?? {})) {
    const read = readTypedInput(text, 'en-GB', typing.ctxFor(sheet.id));
    if (read.kind !== 'value') throw new Error(`${a1}: ${text}`);
    sheet.cells.set(key(a1), { input: read.input });
  }
  for (const [a1, f] of Object.entries(o.formats ?? {})) {
    const before = sheet.cells.get(key(a1));
    sheet.cells.set(key(a1), { ...before, format: { ...before?.format, ...f } });
  }
  return sheet;
}

export type MountedGrid = ReturnType<typeof render> & {
  store: SheetStore;
  sheetId: string;
  writes: SheetWrite[];
  toasts: string[];
  calls: ActionCall[];
  grid: HTMLElement;
  viewport: HTMLElement;
  c: () => SheetController;
  actions: () => SheetActions;
  called: (name: keyof SheetActions) => ActionCall[1][];
};

export async function mountGrid(o: MountOptions = {}): Promise<MountedGrid> {
  const by = { id: 'me', name: 'Me', color: '#000000' };
  const writes: SheetWrite[] = [];
  const toasts: string[] = [];
  const sheetId = `sheet${String(++seq).padStart(4, '0')}`;
  const json = sheetToJson(initialSheet(sheetId, o));
  const store = new SheetStore({
    scope: { documentId: 'd1', ownerId: 'o', shareCode: null, tabId: null },
    self: () => by,
    locale: 'en-GB',
    pushUndo: () => {},
    toast: (m) => toasts.push(m),
    api: {
      fetchSheets: async () => [json],
      writeSheet: (_s: unknown, _id: string, req: { write: SheetWrite }) => {
        writes.push(req.write);
        return new Promise(() => {});
      },
    } as never,
  });
  await store.loadTab(TAB_ID);
  const calls: ActionCall[] = [];
  const ref: { c: SheetController | null; actions: SheetActions | null } = {
    c: null,
    actions: null,
  };
  const palette = planPalette('light');
  const pointRef: PointRef = o.pointRef ?? (() => false);
  const bridge =
    o.bridge === null
      ? null
      : ({
          selectElement: () => {},
          ...o.bridge,
        } as SheetsBridge);

  function Inner() {
    const real = useSheetActions();
    // Each action, logged then run for real.
    const actions = useMemo(() => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(real))
        out[k] =
          typeof v === 'function'
            ? (...args: unknown[]) => {
                calls.push([k as keyof SheetActions, args]);
                return (v as (...a: unknown[]) => unknown)(...args);
              }
            : v;
      return out as SheetActions;
    }, [real]);
    ref.actions = actions;
    const input = useFormulaInput(actions);
    return (
      <SheetGrid
        elementId="el1"
        actions={actions}
        input={input}
        pointRef={pointRef}
        peers={o.peers ?? []}
        {...(o.zoom ? { zoom: o.zoom } : {})}
      />
    );
  }

  function Host() {
    const version = useSyncExternalStore(store.subscribe, store.getVersion);
    const c = useSheetControllerState({
      store,
      sheet: store.sheet(sheetId)!,
      workbook: store.workbook(TAB_ID),
      version,
      palette,
      interactive: o.interactive ?? true,
      canEdit: o.canEdit ?? true,
      maximised: o.maximised ?? false,
      locale: 'en-GB',
      announce: () => {},
      toast: (m) => toasts.push(m),
      notify: () => {},
    });
    ref.c = c;
    return (
      <SheetControllerProvider value={c}>
        <Inner />
      </SheetControllerProvider>
    );
  }

  const view = render(
    <SheetsBridgeContext.Provider value={bridge}>
      <Host />
    </SheetsBridgeContext.Provider>,
  );
  const grid = within(view.container).getByRole('grid');
  const viewport = grid.firstElementChild!.firstElementChild as HTMLElement;
  return {
    ...view,
    store,
    sheetId,
    writes,
    toasts,
    calls,
    grid,
    viewport,
    c: () => ref.c!,
    actions: () => ref.actions!,
    called: (name: keyof SheetActions) => calls.filter(([k]) => k === name).map(([, a]) => a),
  };
}

// The middle of cell (r, c) in the viewport, for a grid of default sizes at no scroll.
export const cellPoint = (r: number, c: number) => ({
  clientX: ROW_HEADER_PX + c * 100 + 50,
  clientY: COL_HEADER_PX + r * 24 + 12,
});
