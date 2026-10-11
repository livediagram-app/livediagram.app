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
import {
  CHART_MIN_HEIGHT,
  CHART_MIN_WIDTH,
  chartRangeOf,
  chartSizeOf,
  movedAnchor,
  newChartAnchor,
  placeSheetChart,
  resizedChart,
  sheetChartsRemoval,
  takePlacedChart,
} from './sheet-charts';
import { geometryOf } from './sheet-geometry';
import { SheetLinkedChart } from './SheetLinkedChart';

vi.mock('@/lib/api/sheets', () => ({
  fetchSheets: vi.fn(),
  createSheet: vi.fn(),
  writeSheet: vi.fn(),
  deleteSheet: vi.fn(),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
import { track } from '@/lib/telemetry';

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
    sheetRetitled: vi.fn(),
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
      range: { r1: R[1], c1: C[0], r2: R[2], c2: C[1] },
    });
    expect(chartRangeOf(book, s, sel(1, 1, 1, 1))).toEqual({ range });
    expect(chartRangeOf(book, s, sel(5, 3, 5, 3))).toBeNull();
  });

  // sheet.md "Charts": the labels in A and the amounts in C, picked together, leave B out.
  it('charts several ranges as one, reading only the columns picked', async () => {
    const { store } = wb();
    await store.loadTab('t1');
    const book = store.workbook('t1');
    const s = store.sheet('sheetAAAA')!;
    const pick = chartRangeOf(book, s, {
      ranges: [
        { r1: 1, c1: 2, r2: 3, c2: 2 },
        { r1: 1, c1: 0, r2: 3, c2: 0 },
      ],
      active: { r: 1, c: 0 },
    });
    expect(pick).toEqual({
      range: { r1: R[1], c1: C[0], r2: R[3], c2: C[2] },
      cols: [C[0], C[2]],
    });
    // Ranges that cover every column between them need no list.
    expect(
      chartRangeOf(book, s, {
        ranges: [
          { r1: 1, c1: 0, r2: 2, c2: 0 },
          { r1: 1, c1: 1, r2: 2, c2: 1 },
        ],
        active: { r: 1, c: 0 },
      }),
    ).toEqual({ range: { r1: R[1], c1: C[0], r2: R[2], c2: C[1] } });
  });
});

describe('placing a chart', () => {
  const anchor = { x: 300, y: 40 };
  it('puts it in the Sheet at its anchor, over the Sheet top right on the canvas, linked to the range', () => {
    const b = bridge();
    const sheetEl = { x: 100, y: 50, width: 900, height: 500 } as ShapeElement;
    placeSheetChart(b, sheetEl, 'sheetAAAA', 'line', { range }, anchor);
    const [at, make, opts] = vi.mocked(b.placeElement).mock.calls[0]!;
    expect(at).toEqual({ x: 100 + 900 - 24 - 150, y: 50 + 120 + 120 });
    // Selected in its Sheet, not on the canvas.
    expect(opts).toEqual({ select: false });
    const made = make(0, 0) as ShapeElement;
    expect(made).toMatchObject({
      shape: 'line-chart',
      chartSource: { sheetId: 'sheetAAAA', range },
      sheetAnchor: anchor,
    });
    expect(made).not.toHaveProperty('chartVariant');
    // The Sheet selects the chart this person placed, once.
    expect(takePlacedChart(made.id)).toBe(true);
    expect(takePlacedChart(made.id)).toBe(false);
    // A Sheet narrower than the chart takes it at its left edge.
    placeSheetChart(b, { ...sheetEl, width: 100 }, 'sheetAAAA', 'pie', { range }, anchor);
    expect(vi.mocked(b.placeElement).mock.calls[1]![0].x).toBe(100 + 130);
    // Only some columns picked: the source names them.
    placeSheetChart(b, sheetEl, 'sheetAAAA', 'column', { range, cols: [C[0]!, C[2]!] }, anchor);
    expect(vi.mocked(b.placeElement).mock.calls[2]![1](0, 0)).toMatchObject({
      chartSource: { sheetId: 'sheetAAAA', range, cols: [C[0], C[2]] },
    });
    // A template's chart: its own size and palette, never selected, never counted as Insert Chart.
    vi.mocked(track).mockClear();
    placeSheetChart(b, sheetEl, 'sheetAAAA', 'pie', { range }, anchor, {
      size: { width: 420, height: 240 },
      palette: 'forest',
      template: true,
    });
    const tpl = vi.mocked(b.placeElement).mock.calls[3]![1](0, 0) as ShapeElement;
    expect(tpl).toMatchObject({ width: 420, height: 240, chartPalette: 'forest' });
    expect(takePlacedChart(tpl.id)).toBe(false);
    expect(track).not.toHaveBeenCalled();
    // A variant type is its kind and its variant (docs/specs/009-elements/pie-chart.md "Chart types").
    placeSheetChart(b, sheetEl, 'sheetAAAA', 'bar', { range }, anchor);
    expect(vi.mocked(b.placeElement).mock.calls[4]![1](0, 0)).toMatchObject({
      shape: 'bar-chart',
      chartVariant: 'horizontal',
    });
  });

  it('anchors it right of the range, level with its top row, inside the cells in view', async () => {
    const store = sheetStoreFor({
      scope: { documentId: 'anchor', ownerId: 'o', shareCode: null, tabId: null },
      self: () => by,
      locale: 'en-GB',
      pushUndo: vi.fn(),
      toast: vi.fn(),
    });
    await store.loadTab('t1');
    const s = store.sheet('sheetAAAA')!;
    const g = geometryOf(s.layout, new Set());
    const size = { width: 260, height: 220 };
    const big = { width: 2000, height: 2000 };
    const none = { top: 0, left: 0 };
    // Columns A and B (to x = cols[2]), rows 1 to 3.
    expect(newChartAnchor(g, s, { range }, size, none, big)).toEqual({
      x: g.cols[2]! + 24,
      y: 24,
    });
    // A view too narrow for it there: pulled back in, 24 px from its right edge.
    expect(newChartAnchor(g, s, { range }, size, none, { width: 400, height: 2000 }).x).toBe(
      400 - 260 - 24,
    );
    // Scrolled past the range: brought into view.
    expect(newChartAnchor(g, s, { range }, size, { top: 900, left: 700 }, big)).toEqual({
      x: 724,
      y: 924,
    });
    // A view smaller than the chart: at its top-left, 24 px in.
    expect(newChartAnchor(g, s, { range }, size, none, { width: 100, height: 100 })).toEqual({
      x: 24,
      y: 24,
    });
    // A range no longer in the sheet: the view's corner.
    const gone = { r1: 'zzzz', c1: 'zzzz', r2: 'zzzz', c2: 'zzzz' };
    expect(newChartAnchor(g, s, { range: gone }, size, none, big)).toEqual({ x: 24, y: 24 });
    expect(chartSizeOf('column')).toEqual({ width: 260, height: 220 });
    expect(chartSizeOf('scatter')).toEqual(chartSizeOf('line'));
  });

  it('moves within the sheet and resizes no smaller than the least chart', () => {
    expect(movedAnchor({ x: 50, y: 50 }, 10.4, -20.6)).toEqual({ x: 60, y: 29 });
    expect(movedAnchor({ x: 50, y: 50 }, -100, -100)).toEqual({ x: 0, y: 0 });
    expect(movedAnchor({ x: 999_990, y: 0 }, 100, 0).x).toBe(1_000_000);
    expect(resizedChart({ width: 260, height: 220 }, 40, -10)).toEqual({ width: 300, height: 210 });
    expect(resizedChart({ width: 260, height: 220 }, -500, -500)).toEqual({
      width: CHART_MIN_WIDTH,
      height: CHART_MIN_HEIGHT,
    });
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

// sheet.md "Sheet Settings": Clear Sheet takes the charts anchored in its Sheet, and its undo puts them back.
describe('the charts Clear Sheet takes', () => {
  it('takes only the anchored charts of its sheet, quietly, and puts them back', () => {
    const anchored = chart({ id: 'in', sheetAnchor: { x: 0, y: 0 } });
    const floating = chart({ id: 'float' });
    const other = chart({
      id: 'other',
      sheetAnchor: { x: 0, y: 0 },
      chartSource: { sheetId: 'sheetBBBB', range },
    });
    const b = bridge();
    b.elements = [anchored, floating, other];
    expect(sheetChartsRemoval(b, [floating, other], 'sheetAAAA')).toBeNull();
    const step = sheetChartsRemoval(b, b.elements, 'sheetAAAA')!;
    step.redo();
    expect(b.elements.map((el) => el.id)).toEqual(['float', 'other']);
    step.undo();
    expect(b.elements.map((el) => el.id).sort()).toEqual(['float', 'in', 'other']);
    // Already back: nothing added twice.
    step.undo();
    expect(b.elements).toHaveLength(3);
    expect(b.commitElements).not.toHaveBeenCalled();
  });
});
