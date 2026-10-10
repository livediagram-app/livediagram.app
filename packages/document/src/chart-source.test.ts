import { describe, expect, it } from 'vitest';
import { chartFieldsFromTable, isChartSource } from './chart-source';
import { withSheetCharts } from './containment';
import { duplicateElements } from './duplicate';
import { copiedSheetId, relinkCopiedCharts } from './chart-source';
import { createShape } from './shape-factory';
import { shapeValidationIssue } from './validate-shape';

const range = { r1: 'aaaa', c1: 'bbbb', r2: 'cccc', c2: 'dddd' };
const table = {
  categories: ['Jan', 'Feb'],
  series: [
    { name: 'Sales', values: [10, -2] },
    { name: 'Costs', values: [4, 5] },
  ],
};

describe('a chart drawn from a sheet range', () => {
  it('names a sheet and a range by row and column ids', () => {
    expect(isChartSource({ sheetId: 'sheet0001', range })).toBe(true);
    expect(isChartSource({ sheetId: 'sheet0001', range, cols: ['aaaa', 'bbbb'] })).toBe(true);
    for (const bad of [
      { sheetId: 'sheet0001', range, cols: [] },
      { sheetId: 'sheet0001', range, cols: ['aaaa', 'aaaa'] },
      { sheetId: 'sheet0001', range, cols: ['NO'] },
      { sheetId: 'sheet0001', range, cols: 'aaaa' },
      { sheetId: 'sheet0001', range, cols: Array.from({ length: 14 }, (_, i) => `col${i}aa`) },
      null,
      { sheetId: 'x', range },
      { sheetId: 'sheet0001' },
      { sheetId: 'sheet0001', range: { ...range, r1: 'NO' } },
      { sheetId: 'sheet0001', range: { ...range, extra: 'aaaa' } },
      { sheetId: 'sheet0001', range, more: 1 },
    ])
      expect(isChartSource(bad)).toBe(false);
    const chart = createShape('bar-chart', 0, 0);
    expect(
      shapeValidationIssue({ ...chart, chartSource: { sheetId: 'sheet0001', range } }),
    ).toBeNull();
    expect(
      shapeValidationIssue({ ...chart, chartSource: { sheetId: 'x' } as never }),
    ).not.toBeNull();
  });

  it('gives a bar its first series, a pie never below zero, and a line every series, keeping colours', () => {
    expect(
      chartFieldsFromTable(
        { shape: 'bar-chart', pieSlices: [{ label: 'x', value: 1, color: '#ff0000' }] },
        table,
      ),
    ).toEqual({
      pieSlices: [
        { label: 'Jan', value: 10, color: '#ff0000' },
        { label: 'Feb', value: -2 },
      ],
    });
    expect(chartFieldsFromTable({ shape: 'pie-chart' }, table)).toEqual({
      pieSlices: [
        { label: 'Jan', value: 10 },
        { label: 'Feb', value: 0 },
      ],
    });
    expect(
      chartFieldsFromTable(
        { shape: 'line-chart', lineSeries: [{ name: 'old', values: [], color: '#00ff00' }] },
        table,
      ),
    ).toEqual({
      lineCategories: ['Jan', 'Feb'],
      lineSeries: [
        { name: 'Sales', values: [10, -2], color: '#00ff00' },
        { name: 'Costs', values: [4, 5] },
      ],
    });
    expect(chartFieldsFromTable({ shape: 'bar-chart' }, { categories: ['a'], series: [] })).toEqual(
      {
        pieSlices: [{ label: 'a', value: 0 }],
      },
    );
  });

  it('moves with its Sheet while it sits on it', () => {
    const sheet = {
      ...createShape('plan-sheet', 0, 0),
      id: 's',
      planSheet: { sheetId: 'sheet0001' },
    };
    const chart = (id: string, x: number, sheetId = 'sheet0001') => ({
      ...createShape('bar-chart', x, 10),
      id,
      chartSource: { sheetId, range },
    });
    const els = [
      sheet,
      chart('on', 20),
      chart('off', 5000),
      chart('other', 20, 'sheet0002'),
      createShape('square', 20, 10),
    ];
    expect([...withSheetCharts(els as never, new Set(['s']))].sort()).toEqual(['on', 's']);
    const none = new Set(['on']);
    expect(withSheetCharts(els as never, none)).toBe(none);
  });

  it('reads the copy of its Sheet when copied with it, and the original otherwise', () => {
    const sheet = {
      ...createShape('plan-sheet', 0, 0),
      id: 's',
      planSheet: { sheetId: 'sheet0001' },
    };
    const linked = {
      ...createShape('bar-chart', 20, 10),
      id: 'c',
      chartSource: { sheetId: 'sheet0001', range },
    };
    const both = duplicateElements([sheet, linked] as never, new Set(['s', 'c']), 10, 10)
      .newElements as never[];
    const [sheetCopy, chartCopy] = both as unknown as [typeof sheet, typeof linked];
    expect(chartCopy.chartSource.sheetId).toBe(sheetCopy.planSheet.sheetId);
    expect(chartCopy.chartSource.sheetId).not.toBe('sheet0001');
    const alone = duplicateElements([sheet, linked] as never, new Set(['c']), 10, 10).newElements;
    expect((alone[0] as typeof linked).chartSource.sheetId).toBe('sheet0001');
    expect(relinkCopiedCharts([linked], new Map())).toEqual([linked]);
    expect(copiedSheetId(sheet, sheet)).toBeNull();
    expect(copiedSheetId(linked, sheet)).toBeNull();
  });
});
