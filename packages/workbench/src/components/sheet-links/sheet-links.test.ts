// Charts and tables with live data from a plan, the pure half (each reader app's docs/specs/009-elements/pie-chart.md
// "Live data from a plan", liveworkspace/docs/specs/004-index/live-data.md): one key per source, what a live read
// shows and what it would save, and the words.
import { describe, expect, it } from 'vitest';
import type { ChartSheetSource } from '@liveworkspace/element-model/chart-sheet-source';
import type { PlanDataRead, SheetRangeRead } from '@liveworkspace/index-client';
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
  liveFields,
  isChart,
  isLinkable,
  isLiveTable,
  drawnTable,
  frameTouches,
  frozenDay,
  type LiveTable,
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
    const fields = liveFields(line, read.table) as Parameters<typeof sameChartData>[1];
    expect(sameChartData(line, fields)).toBe(false);
    expect(sameChartData({ ...line, ...fields }, fields)).toBe(true);
    expect(liveFields({ ...line, ...fields }, read.table)).toBeNull();
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
      lead: 'Live from',
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
      lead: 'From',
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

describe('boards, metrics and tables (live-data.md)', () => {
  const board: ChartSheetSource = {
    app: 'liveplanner',
    itemId: 'plan_1',
    itemName: 'Launch',
    readAt: 1_000,
    kind: 'board',
    boardId: 'tab_1',
    by: 'column',
    filter: { priority: 'high' },
    sourceName: 'Roadmap',
    label: 'Cards per column',
  };
  const metric: ChartSheetSource = {
    app: 'liveplanner',
    itemId: 'plan_1',
    itemName: 'Launch',
    readAt: 1_000,
    kind: 'metric',
    metric: 'completion',
    sourceName: 'Dashboard',
    label: 'Completion',
  };
  const boardRead: PlanDataRead = {
    itemId: 'plan_1',
    itemName: 'Launch 2',
    kind: 'board',
    sourceName: 'Roadmap v2',
    tabId: 'tab_1',
    label: 'Cards per column',
    table: {
      categories: ['To Do', 'Done'],
      series: [
        { name: 'Cards', values: [3, 4] },
        { name: 'Points', values: [8, 1.5] },
      ],
    },
    readAt: 7_000,
  };
  const table = (extra: Partial<LiveTable> = {}): LiveTable => ({
    id: 't',
    type: 'table',
    cells: [['a']],
    ...extra,
  });

  it('keys a board by its plan, board, count and filter, a metric by its plan and id', () => {
    expect(sheetLinkKey(board)).toBe('board|plan_1|tab_1|column|{"priority":"high"}');
    expect(sheetLinkKey({ ...board, filter: undefined })).toBe('board|plan_1|tab_1|column|{}');
    expect(sheetLinkKey(metric)).toBe('metric|plan_1|completion');
  });

  it('re-reads a board or metric on the cards signal, a range on its Sheet', () => {
    expect(frameTouches(board, 'plan_1', ['cards'])).toBe(true);
    expect(frameTouches(metric, 'plan_1', ['sheet0001'])).toBe(false);
    expect(frameTouches(source, 'plan_1', ['cards'])).toBe(false);
    expect(frameTouches(source, 'plan_1', ['sheet0001'])).toBe(true);
    expect(frameTouches(board, 'plan_2', ['cards'])).toBe(false);
  });

  it('tells a table, and takes charts and tables as linkable', () => {
    expect(isLiveTable(table())).toBe(true);
    expect(isLiveTable({ id: 'x', type: 'table' })).toBe(false);
    expect(isLinkable(table())).toBe(true);
    expect(isLinkable(shape('square'))).toBe(false);
    expect(linkedChartsOn([table({ chartSheetSource: board }), table()])).toHaveLength(1);
  });

  it("writes a table's cells with a header, its label column named for the count", () => {
    expect(liveFields(table({ chartSheetSource: board }), boardRead.table)).toEqual({
      cells: [
        ['Column', 'Cards', 'Points'],
        ['To Do', '3', '8'],
        ['Done', '4', '1.5'],
      ],
      headerRow: true,
      colWidths: undefined,
      rowHeights: undefined,
      cellStyles: undefined,
    });
    expect(
      (liveFields(table({ chartSheetSource: metric }), boardRead.table) as { cells: string[][] })
        .cells[0]![0],
    ).toBe('Completion');
    expect(
      (liveFields(table({ chartSheetSource: source }), boardRead.table) as { cells: string[][] })
        .cells[0]![0],
    ).toBe('');
    expect(drawnTable(table(), boardRead.table)).toEqual({ table: boardRead.table, leftOut: 0 });
  });

  it('feeds only the series the link picks, in its order', () => {
    const el = bar({ chartSheetSource: { ...board, series: [1] } });
    expect(chartAsSeen(el, { kind: 'live', read: boardRead }).pieSlices).toEqual([
      { label: 'To Do', value: 8, color: '#f00' },
      { label: 'Done', value: 1.5 },
    ]);
  });

  it('keeps a board link with the read names and time', () => {
    const after = sourceAfterRead(board, boardRead);
    expect(after).toMatchObject({ itemName: 'Launch 2', sourceName: 'Roadmap v2', readAt: 7_000 });
    expect(sameSource(board, after)).toBe(false);
    expect(sameSource(after, { ...after, readAt: 1 })).toBe(true);
    // A read of the other shape only renames the plan.
    expect(sourceAfterRead(board, read)).toEqual({
      ...board,
      itemName: 'Budget 2027',
      readAt: 9_000,
    });
  });

  it('says a frozen link is frozen, with its day', () => {
    const now = Date.UTC(2026, 10, 20, 12);
    const readAt = Date.UTC(2026, 10, 12, 12);
    expect(sheetLinkLine({ ...board, frozen: true, readAt }, { kind: 'frozen' }, now)).toEqual({
      lead: 'From',
      name: 'Launch',
      detail: 'frozen 12 Nov',
      tone: 'quiet',
    });
    expect(frozenDay(Date.UTC(2025, 0, 3, 12), now)).toBe('3 Jan 2025');
  });
});
