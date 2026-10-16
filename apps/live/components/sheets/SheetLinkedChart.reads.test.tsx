// @vitest-environment jsdom
// A chart drawn from a sheet reads its range only when the range can have changed (docs/specs/029-sheets/sheet.md
// "Performance"): the sheet store moving on, its source or the locale. A re-render that changes none of them (a scroll
// frame, a canvas drag, a resize of the chart) never reads the table again, nor re-compares the kept read.
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as sheets from '@livediagram/sheets';
import { emptyLayout, type SheetJson } from '@livediagram/sheets';
import type { Element, ShapeElement } from '@livediagram/document';
import * as api from '@/lib/api/sheets';
import { SheetsBridgeContext, type SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import { forgetSheetStores } from './sheet-store-client';
import { SheetLinkedChart } from './SheetLinkedChart';

vi.mock('@livediagram/sheets', async (importOriginal) => {
  const real = await importOriginal<typeof import('@livediagram/sheets')>();
  return { ...real, sheetChartTable: vi.fn(real.sheetChartTable) };
});
vi.mock('@/lib/api/sheets', () => ({
  fetchSheets: vi.fn(),
  createSheet: vi.fn(),
  writeSheet: vi.fn(),
  deleteSheet: vi.fn(),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const by = { id: 'me', name: 'Me', color: '#000000' };
let seq = 11;
const rand = () => ((seq = (seq * 16807) % 2147483647) - 1) / 2147483646;
// The worst case a chart reads: 500 categories by 12 series and a label column.
const ROWS = 501;
const COLS = 13;
const layout = emptyLayout(rand, ROWS, COLS);
const sheet: SheetJson = {
  id: 'sheetBIG01',
  tabId: 't1',
  title: 'Big',
  layout,
  cells: layout.rows.flatMap((r, ri) =>
    layout.cols.map((c, ci) => ({
      r,
      c,
      i: ri === 0 ? { s: `S${ci}` } : ci === 0 ? { s: `Row ${ri}` } : { n: ri * ci },
    })),
  ),
  rev: 0,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: by,
};
const range = {
  r1: layout.rows[0]!,
  c1: layout.cols[0]!,
  r2: layout.rows[ROWS - 1]!,
  c2: layout.cols[COLS - 1]!,
};
const chart: ShapeElement = {
  id: 'chart1',
  type: 'shape',
  shape: 'line-chart',
  x: 0,
  y: 0,
  width: 260,
  height: 220,
  chartSource: { sheetId: 'sheetBIG01', range },
};

let docSeq = 0;
function bridge(): SheetsBridge {
  const b = {
    scope: { documentId: `reads${docSeq++}`, ownerId: 'o', shareCode: null, tabId: null },
    activeTabId: 't1',
    self: by,
    canEdit: false,
    canShape: true,
    locale: 'en-GB',
    peers: [],
    pushUndo: vi.fn(),
    toast: vi.fn(),
    notify: vi.fn(),
    sendPresence: vi.fn(),
    placeElement: vi.fn(),
    tickElements: vi.fn((_map: (els: Element[]) => Element[]) => {}),
    commitElements: vi.fn(),
    switchToPlan: vi.fn(),
    selectElement: vi.fn(),
    sheetRetitled: vi.fn(),
    attach: vi.fn(() => () => {}),
  };
  return b;
}

const reads = vi.mocked(sheets.sheetChartTable);

beforeEach(() => {
  forgetSheetStores();
  vi.mocked(api.fetchSheets).mockResolvedValue([sheet]);
});

describe('a chart drawn from a big sheet', () => {
  it('reads its range once, however often it re-renders, and again when resized only for the new size', async () => {
    const b = bridge();
    const view = (el: ShapeElement, frame: number) => (
      <SheetsBridgeContext.Provider value={b}>
        <SheetLinkedChart element={el}>
          {(live) => (
            <i data-testid="chart" data-frame={frame}>
              {live.lineCategories?.length ?? 0}
            </i>
          )}
        </SheetLinkedChart>
      </SheetsBridgeContext.Provider>
    );
    const r = render(view(chart, 0));
    await waitFor(() => expect(screen.getByTestId('chart').textContent).toBe('500'));
    reads.mockClear();
    // Scroll frames: the same element, a new render function each time.
    const t0 = performance.now();
    for (let frame = 1; frame <= 60; frame++) act(() => r.rerender(view(chart, frame)));
    const perFrame = (performance.now() - t0) / 60;
    expect(reads).not.toHaveBeenCalled();
    // A resize draws a new element of the same source each frame: still no new read.
    for (let frame = 1; frame <= 10; frame++)
      act(() => r.rerender(view({ ...chart, width: 260 + frame }, frame)));
    expect(reads).not.toHaveBeenCalled();
    // A budget a frame can afford (16 ms), with room for a loaded CI machine.
    expect(perFrame).toBeLessThan(8);
  });
});
