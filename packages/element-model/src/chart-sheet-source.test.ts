// A chart linked to a liveplanner sheet (livedocuments docs/specs/009-elements/pie-chart.md "Charts linked to a
// liveplanner sheet"): the stored link's guard, freezing for exports and Community copies, and the table a read gives a
// chart's data fields.
import { describe, expect, it } from 'vitest';
import {
  isChartSheetSource,
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
