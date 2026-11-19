// Charts linked to a liveplanner sheet, the pure half (each reader app's docs/specs/009-elements/pie-chart.md "Charts
// linked to a liveplanner sheet"): one key per range, what a live read shows and what it would save, and the words.
import { describe, expect, it } from 'vitest';
import type { ChartSheetSource } from '@liveworkspace/element-model/chart-sheet-source';
import type { SheetRangeRead } from '@liveworkspace/index-client';
import {
  chartAsSeen,
  isLinkedChart,
  linkedAgo,
  linkedChartsOn,
  sameChartData,
  sameSource,
  sheetLinkKey,
  sheetLinkLine,
  sourceAfterRead,
  liveChartFields,
  isChart,
  drawnTable,
  type SheetChart,
} from './sheet-links';

const shape = (kind: string, id = kind): SheetChart => ({ id, type: 'shape', shape: kind });

const source: ChartSheetSource = {
  app: 'liveplanner',
  itemId: 'plan_1',
  sheetId: 'sheet0001',
  range: { r1: 'r001', c1: 'c001', r2: 'r003', c2: 'c002' },
  itemName: 'Budget',
  sheetName: 'Costs',
  a1: 'A1:B3',
  readAt: 1_000,
};

const read: SheetRangeRead = {
  itemId: 'plan_1',
  itemName: 'Budget 2027',
  sheetId: 'sheet0001',
  sheetName: 'Costs',
  tabId: 't1',
  range: source.range,
  a1: 'A1:B3',
  table: { categories: ['Q1', 'Q2'], series: [{ name: 'Sales', values: [10, 20] }] },
  readAt: 9_000,
};

const bar = (extra: Partial<SheetChart> = {}): SheetChart => ({
  ...shape('bar-chart'),
  pieSlices: [
    { label: 'Q1', value: 1, color: '#f00' },
    { label: 'Q2', value: 2 },
  ],
  ...extra,
});

describe('which charts are linked', () => {
  it('finds charts with a link, and nothing else', () => {
    const linked = bar({ chartSheetSource: source });
    const box = shape('square');
    const arrow = { id: 'a1', type: 'arrow' };
    expect(linkedChartsOn([linked, bar(), box, arrow])).toEqual([linked]);
    expect(isLinkedChart({ ...box, chartSheetSource: source })).toBe(false);
    expect(isChart(arrow)).toBe(false);
    expect(isChart({ id: 'x', type: 'shape' })).toBe(false);
    expect(isChart(shape('pie-chart'))).toBe(true);
  });

  it('keys a range by plan, sheet, corners and columns', () => {
    expect(sheetLinkKey(source)).toBe('plan_1|sheet0001|r001:c001:r003:c002|');
    expect(sheetLinkKey({ ...source, cols: ['c001', 'c002'] })).toBe(
      'plan_1|sheet0001|r001:c001:r003:c002|c001,c002',
    );
  });
});

describe('a live read', () => {
  it('draws its values over the saved ones, keeping colours, and leaves other statuses alone', () => {
    const el = bar({ chartSheetSource: source });
    expect(chartAsSeen(el, { kind: 'live', read }).pieSlices).toEqual([
      { label: 'Q1', value: 10, color: '#f00' },
      { label: 'Q2', value: 20 },
    ]);
    expect(chartAsSeen(el, { kind: 'saved' })).toBe(el);
    expect(chartAsSeen(el, undefined)).toBe(el);
  });

  it('answers the same element when the read changes nothing', () => {
    const el = bar({
      pieSlices: [
        { label: 'Q1', value: 10 },
        { label: 'Q2', value: 20 },
      ],
    });
    expect(chartAsSeen(el, { kind: 'live', read })).toBe(el);
  });

  it('compares a line chart by its categories and series', () => {
    const line = shape('line-chart');
    const fields = liveChartFields(line, read);
    expect(sameChartData(line, fields)).toBe(false);
    expect(sameChartData({ ...line, ...fields }, fields)).toBe(true);
  });

  it('reads a chart with no rows stored as empty', () => {
    expect(sameChartData(shape('bar-chart'), { pieSlices: [] })).toBe(true);
    expect(
      sameChartData(
        { ...shape('line-chart'), lineCategories: ['Q1'] },
        { lineCategories: ['Q1'], lineSeries: [] },
      ),
    ).toBe(true);
  });

  it('leaves the link with the read names, range and time', () => {
    const after = sourceAfterRead(source, read);
    expect(after).toEqual({ ...source, itemName: 'Budget 2027', readAt: 9_000 });
    expect(sameSource(source, after)).toBe(false);
    expect(sameSource(after, { ...after, readAt: 1 })).toBe(true);
  });
});

describe('the words', () => {
  it('says how long ago', () => {
    expect(linkedAgo(1_000, 1_000)).toBe('just now');
    expect(linkedAgo(0, 3 * 60_000)).toBe('3 min ago');
    expect(linkedAgo(5_000, 1_000)).toBe('just now');
  });

  it('names the plan and how fresh the values are for each status', () => {
    const now = 1_000 + 2 * 60 * 60_000;
    expect(sheetLinkLine(source, { kind: 'live', read: { ...read, readAt: now } }, now)).toEqual({
      name: 'Budget',
      detail: 'updated just now',
      tone: 'live',
    });
    expect(sheetLinkLine(source, { kind: 'saved' }, now).detail).toBe('saved 2 hours ago');
    expect(sheetLinkLine(source, { kind: 'reading' }, now).tone).toBe('quiet');
    expect(sheetLinkLine(source, { kind: 'gone' }, now)).toMatchObject({
      detail: 'The linked range is gone',
      tone: 'warn',
    });
    expect(sheetLinkLine({ ...source, itemName: '' }, { kind: 'failed' }, now)).toEqual({
      name: 'a plan',
      detail: "Couldn't update, saved 2 hours ago",
      tone: 'warn',
    });
  });
});

// Work Tracker 1212: the Link to Sheet preview shows what Link would write.
describe('what a preview shows', () => {
  const table = {
    categories: ['1', '2'],
    series: [
      { name: 'X', values: [3, 4] },
      { name: 'Y', values: [5, 6] },
    ],
  };
  it('keeps a pie or bar to its first series, counting the rest left out', () => {
    expect(drawnTable(shape('bar-chart'), table)).toEqual({
      table: { categories: ['1', '2'], series: [table.series[0]] },
      leftOut: 1,
    });
    expect(drawnTable(shape('pie-chart'), { categories: [], series: [] }).leftOut).toBe(0);
  });
  it('keeps every series of a line, and a scatter takes a numbered first column as its x', () => {
    expect(drawnTable(shape('line-chart'), table)).toEqual({ table, leftOut: 0 });
    expect(drawnTable({ ...shape('line-chart'), chartVariant: 'scatter' }, table)).toEqual({
      table: { categories: ['3', '4'], series: [table.series[1]] },
      leftOut: 0,
    });
  });
});
