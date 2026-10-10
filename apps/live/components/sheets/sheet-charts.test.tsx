// @vitest-environment jsdom
// Charts made from a sheet's cells (docs/specs/029-sheets/sheet.md "Charts"): the range a selection gives, the chart
// placed over the Sheet linked to it, and the live read that draws it and keeps the element's last read.
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLayout, Workbook, type SheetJson } from '@livediagram/sheets';
import type { Element, ShapeElement } from '@livediagram/document';
import * as api from '@/lib/api/sheets';
import { SheetsBridgeContext, type SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import { forgetSheetStores, sheetStoreFor } from './sheet-store-client';
import { chartRangeOf, placeSheetChart } from './sheet-charts';
import { SheetLinkedChart } from './SheetLinkedChart';

vi.mock('@/lib/api/sheets', () => ({
  fetchSheets: vi.fn(),
  createSheet: vi.fn(),
  writeSheet: vi.fn(),
  deleteSheet: vi.fn(),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const by = { id: 'me', name: 'Me', color: '#000000' };
let seq = 7;
const rand = () => ((seq = (seq * 16807) % 2147483647) - 1) / 2147483646;
const layout = emptyLayout(rand, 6, 4);
const R = layout.rows;
const C = layout.cols;

const sheet: SheetJson = {
  id: 'sheetAAAA',
  tabId: 't1',
  title: 'Sales',
  layout,
  cells: [
    { r: R[0]!, c: C[0]!, i: { s: 'Month' } },
    { r: R[0]!, c: C[1]!, i: { s: 'Sales' } },
    { r: R[1]!, c: C[0]!, i: { s: 'Jan' } },
    { r: R[1]!, c: C[1]!, i: { n: 12 } },
    { r: R[2]!, c: C[0]!, i: { s: 'Feb' } },
    { r: R[2]!, c: C[1]!, i: { n: 20 } },
  ],
  rev: 0,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: by,
};
const range = { r1: R[0]!, c1: C[0]!, r2: R[2]!, c2: C[1]! };

let docSeq = 0;
function bridge(over: Partial<SheetsBridge> = {}): SheetsBridge & { elements: Element[] } {
  const b = {
    scope: { documentId: `charts${docSeq++}`, ownerId: 'o', shareCode: null, tabId: null },
    activeTabId: 't1',
    self: by,
    canEdit: true,
    canShape: true,
    locale: 'en-GB',
    peers: [],
    pushUndo: vi.fn(),
    toast: vi.fn(),
    notify: vi.fn(),
    sendPresence: vi.fn(),
    placeElement: vi.fn(),
    tickElements: vi.fn((map: (els: Element[]) => Element[]) => {
      b.elements = map(b.elements);
    }),
    commitElements: vi.fn(),
    switchToPlan: vi.fn(),
    selectElement: vi.fn(),
    attach: vi.fn(() => () => {}),
    elements: [] as Element[],
    ...over,
  };
  return b;
}

const chart = (over: Partial<ShapeElement> = {}): ShapeElement =>
  ({
    id: 'chart1',
    type: 'shape',
    shape: 'bar-chart',
    x: 0,
    y: 0,
    width: 260,
    height: 220,
    pieSlices: [{ label: 'A', value: 1, color: '#ff0000' }],
    chartSource: { sheetId: 'sheetAAAA', range },
    ...over,
  }) as ShapeElement;

const shown = (el: ShapeElement) => (
  <span data-testid="chart">
    {(el.pieSlices ?? []).map((s) => `${s.label}=${s.value}${s.color ?? ''}`).join(',')}
  </span>
);

beforeEach(() => {
  vi.clearAllMocks();
  forgetSheetStores();
  vi.mocked(api.fetchSheets).mockResolvedValue([sheet]);
});

describe('the range a chart reads', () => {
  const wb = () => {
    const w = new Workbook({ sheets: [], locale: 'en-GB' });
    const store = sheetStoreFor({
      scope: { documentId: 'range', ownerId: 'o', shareCode: null, tabId: null },
      self: () => by,
      locale: 'en-GB',
      pushUndo: vi.fn(),
      toast: vi.fn(),
    });
    return { w, store };
  };

  it('is the selection, the data around one cell, or nothing for one empty cell', async () => {
    const { store } = wb();
    await store.loadTab('t1');
    const book = store.workbook('t1');
    const s = store.sheet('sheetAAAA')!;
    const sel = (r1: number, c1: number, r2: number, c2: number) => ({
      ranges: [{ r1, c1, r2, c2 }],
      active: { r: r1, c: c1 },
    });
    expect(chartRangeOf(book, s, sel(1, 0, 2, 1))).toEqual({
      r1: R[1],
      c1: C[0],
      r2: R[2],
      c2: C[1],
    });
    expect(chartRangeOf(book, s, sel(1, 1, 1, 1))).toEqual(range);
    expect(chartRangeOf(book, s, sel(5, 3, 5, 3))).toBeNull();
  });
});

describe('placing a chart', () => {
  it('centres it over the Sheet top right, linked to the range', () => {
    const b = bridge();
    const sheetEl = { x: 100, y: 50, width: 900, height: 500 } as ShapeElement;
    placeSheetChart(b, sheetEl, 'sheetAAAA', 'line-chart', range);
    const [at, make] = vi.mocked(b.placeElement).mock.calls[0]!;
    expect(at).toEqual({ x: 100 + 900 - 24 - 150, y: 50 + 120 + 120 });
    expect(make(0, 0)).toMatchObject({
      shape: 'line-chart',
      chartSource: { sheetId: 'sheetAAAA', range },
    });
    // A Sheet narrower than the chart takes it at its left edge.
    placeSheetChart(b, { ...sheetEl, width: 100 }, 'sheetAAAA', 'pie-chart', range);
    expect(vi.mocked(b.placeElement).mock.calls[1]![0].x).toBe(100 + 130);
  });
});

describe('a chart drawn from a sheet', () => {
  it('draws its own data without the sheets bridge', () => {
    render(<SheetLinkedChart element={chart()}>{shown}</SheetLinkedChart>);
    expect(screen.getByTestId('chart').textContent).toBe('A=1#ff0000');
  });

  it('reads the range live, keeping colours, and saves the read on the element when it changed', async () => {
    const b = bridge();
    b.elements = [chart()];
    render(
      <SheetsBridgeContext.Provider value={b}>
        <SheetLinkedChart element={chart()}>{shown}</SheetLinkedChart>
      </SheetsBridgeContext.Provider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('chart').textContent).toBe('Jan=12#ff0000,Feb=20'),
    );
    expect(b.elements[0]).toMatchObject({
      pieSlices: [
        { label: 'Jan', value: 12, color: '#ff0000' },
        { label: 'Feb', value: 20 },
      ],
    });
  });

  it('draws labels in this person\u2019s locale but keeps them in one fixed locale', async () => {
    const dated: SheetJson = {
      ...sheet,
      cells: sheet.cells.map((cell) =>
        cell.r === R[1] && cell.c === C[0] ? { ...cell, i: { n: 46315 }, f: { nf: 'date' } } : cell,
      ),
    };
    vi.mocked(api.fetchSheets).mockResolvedValue([dated]);
    const b = bridge({ locale: 'en-US' });
    b.elements = [chart()];
    render(
      <SheetsBridgeContext.Provider value={b}>
        <SheetLinkedChart element={chart()}>{shown}</SheetLinkedChart>
      </SheetsBridgeContext.Provider>,
    );
    await waitFor(() => expect(screen.getByTestId('chart').textContent).toContain('10/20/2026=12'));
    expect(b.elements[0]!).toMatchObject({
      pieSlices: [{ label: '20/10/2026', value: 12 }, { label: 'Feb' }],
    });
  });

  it('leaves the element alone for a viewer, and when the sheet is gone', async () => {
    const b = bridge({ canEdit: false });
    render(
      <SheetsBridgeContext.Provider value={b}>
        <SheetLinkedChart element={chart()}>{shown}</SheetLinkedChart>
        <SheetLinkedChart
          element={chart({ id: 'c2', chartSource: { sheetId: 'sheetGONE1', range } })}
        >
          {(el) => <i data-testid="gone">{el.pieSlices?.[0]?.label}</i>}
        </SheetLinkedChart>
      </SheetsBridgeContext.Provider>,
    );
    await waitFor(() => expect(screen.getByTestId('chart').textContent).toContain('Jan=12'));
    expect(screen.getByTestId('gone').textContent).toBe('A');
    expect(b.tickElements).not.toHaveBeenCalled();
  });
});
