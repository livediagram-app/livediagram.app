// A chart linked to a liveplanner sheet (livedocuments docs/specs/009-elements/pie-chart.md "Charts linked to a
// liveplanner sheet"): the stored link's guard, freezing for exports and Community copies, and the table a read gives a
// chart's data fields.
import { describe, expect, it } from 'vitest';
import {
  isChartSheetSource,
  isRangeSource,
  liveSourceWhat,
  sourceKindOf,
  withoutSheetSources,
  type ChartSheetSource,
} from './chart-sheet-source';
import { chartFieldsFromTable } from './chart-table';

const source: ChartSheetSource = {
  app: 'liveplanner',
  itemId: 'plan_1',
  sheetId: 'sheet0001',
  range: { r1: 'r001', c1: 'c001', r2: 'r003', c2: 'c002' },
  itemName: 'Budget',
  sheetName: 'Costs',
  a1: 'A1:B3',
  readAt: 1_700_000_000_000,
};

describe('isChartSheetSource', () => {
  it('takes a well-formed link, with or without picked columns', () => {
    expect(isChartSheetSource(source)).toBe(true);
    expect(isChartSheetSource({ ...source, cols: ['c001', 'c002'] })).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['another app', { ...source, app: 'livediagram' }],
    ['an extra field', { ...source, extra: 1 }],
    ['a bad item id', { ...source, itemId: 'a b' }],
    ['a bad sheet id', { ...source, sheetId: '' }],
    ['a long plan name', { ...source, itemName: 'x'.repeat(201) }],
    ['a missing sheet name', { ...source, sheetName: undefined }],
    ['a long A1', { ...source, a1: 'A'.repeat(25) }],
    ['a negative time', { ...source, readAt: -1 }],
    ['an endless time', { ...source, readAt: Infinity }],
    ['no columns', { ...source, cols: [] }],
    ['repeated columns', { ...source, cols: ['c001', 'c001'] }],
    ['a bad column id', { ...source, cols: ['C!'] }],
    ['no range', { ...source, range: null }],
    ['a range with an extra corner', { ...source, range: { ...source.range, r3: 'r004' } }],
    ['a range with a bad id', { ...source, range: { ...source.range, c2: 'X' } }],
  ])('refuses %s', (_name, v) => {
    expect(isChartSheetSource(v)).toBe(false);
  });
});

describe('live data links (live-data.md)', () => {
  const common = { app: 'liveplanner', itemId: 'plan_1', itemName: 'Launch', readAt: 5 } as const;
  const board: ChartSheetSource = {
    ...common,
    kind: 'board',
    boardId: 'tab_1',
    by: 'column',
    filter: { priority: 'high', label: 'bug' },
    sourceName: 'Roadmap',
    label: 'Cards per column',
  };
  const metric: ChartSheetSource = {
    ...common,
    kind: 'metric',
    metric: 'top-voted',
    sourceName: 'Dashboard',
    label: 'Top Voted',
  };

  it('takes a board, a metric and a range named as a sheet, frozen or with picked series', () => {
    expect(isChartSheetSource(board)).toBe(true);
    expect(isChartSheetSource(metric)).toBe(true);
    expect(isChartSheetSource({ ...source, kind: 'sheet', frozen: true, series: [1, 0] })).toBe(
      true,
    );
    expect(sourceKindOf(source)).toBe('sheet');
    expect(sourceKindOf(board)).toBe('board');
    expect(isRangeSource(metric)).toBe(false);
  });

  it.each([
    ['another kind', { ...board, kind: 'gantt' }],
    ['a count by anything else', { ...board, by: 'status' }],
    ['a bad board id', { ...board, boardId: 'a b' }],
    ['a filter of another key', { ...board, filter: { status: 'x' } }],
    ['an empty filter value', { ...board, filter: { label: '' } }],
    ['a filter that is a list', { ...board, filter: ['x'] }],
    ['a sheet field on a board', { ...board, sheetId: 'sheet0001' }],
    ['a long label', { ...metric, label: 'x'.repeat(81) }],
    ['a bad metric id', { ...metric, metric: 'Top Voted' }],
    ['a board field on a metric', { ...metric, by: 'column' }],
    ['frozen as false', { ...metric, frozen: false }],
    ['no series', { ...metric, series: [] }],
    ['a repeated series', { ...metric, series: [0, 0] }],
    ['a series past the cap', { ...metric, series: [12] }],
    ['a fractional series', { ...metric, series: [0.5] }],
  ])('refuses %s', (_name, v) => {
    expect(isChartSheetSource(v)).toBe(false);
  });

  it('says where each kind reads from', () => {
    expect(liveSourceWhat(source)).toEqual({ name: 'Costs', detail: 'A1:B3' });
    expect(liveSourceWhat(board)).toEqual({ name: 'Roadmap', detail: 'Cards per column' });
    expect(liveSourceWhat({ ...metric, sourceName: '' })).toEqual({
      name: 'Dashboard',
      detail: 'Top Voted',
    });
    expect(liveSourceWhat({ ...board, sourceName: '' }).name).toBe('Board');
    expect(liveSourceWhat({ ...source, sheetName: '' }).name).toBe('Sheet');
  });
});

describe('withoutSheetSources', () => {
  it('drops every link and keeps the saved values', () => {
    const els = [
      { id: 'a', pieSlices: [{ label: 'Q1', value: 1 }], chartSheetSource: source },
      { id: 'b' },
    ];
    expect(withoutSheetSources(els)).toEqual([
      { id: 'a', pieSlices: [{ label: 'Q1', value: 1 }] },
      { id: 'b' },
    ]);
  });

  it('answers the same array when nothing is linked', () => {
    const els = [{ id: 'a' }];
    expect(withoutSheetSources(els)).toBe(els);
  });
});

describe('chartFieldsFromTable', () => {
  const table = { categories: ['Q1', 'Q2'], series: [{ name: 'Sales', values: [10, -2] }] };

  it('gives a pie its first series, never below zero, keeping slice colours', () => {
    expect(
      chartFieldsFromTable(
        { shape: 'pie-chart', pieSlices: [{ label: 'x', value: 0, color: '#f00' }] },
        table,
      ),
    ).toEqual({
      pieSlices: [
        { label: 'Q1', value: 10, color: '#f00' },
        { label: 'Q2', value: 0 },
      ],
    });
  });

  it('gives a bar chart negative values, and zero for a missing value', () => {
    expect(
      chartFieldsFromTable({ shape: 'bar-chart' }, { categories: ['a', 'b'], series: [] }),
    ).toEqual({
      pieSlices: [
        { label: 'a', value: 0 },
        { label: 'b', value: 0 },
      ],
    });
    expect(chartFieldsFromTable({ shape: 'bar-chart' }, table)).toEqual({
      pieSlices: [
        { label: 'Q1', value: 10 },
        { label: 'Q2', value: -2 },
      ],
    });
  });

  it('gives a line chart every series, keeping series colours', () => {
    expect(
      chartFieldsFromTable(
        { shape: 'line-chart', lineSeries: [{ name: 'x', values: [], color: '#0f0' }] },
        table,
      ),
    ).toEqual({
      lineCategories: ['Q1', 'Q2'],
      lineSeries: [{ name: 'Sales', values: [10, -2], color: '#0f0' }],
    });
  });

  it('gives a scatter chart its numbered first column as x', () => {
    const numbered = {
      categories: ['1', '2'],
      series: [
        { name: 'X', values: [3, 4] },
        { name: 'Y', values: [5, 6] },
      ],
    };
    expect(
      chartFieldsFromTable({ shape: 'line-chart', chartVariant: 'scatter' }, numbered),
    ).toEqual({
      lineCategories: ['3', '4'],
      lineSeries: [{ name: 'Y', values: [5, 6] }],
    });
  });
});
