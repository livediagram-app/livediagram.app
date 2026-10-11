import { describe, expect, it } from 'vitest';
import {
  chartFieldsFromTable,
  chartsInSheet,
  isChartSource,
  isSheetAnchor,
  isSheetAnchoredChart,
  SHEET_ANCHOR_MAX,
  sheetDrawnChartIds,
} from './chart-source';
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

  it('sits in its Sheet at an anchor of px from the corner of its cells', () => {
    expect(isSheetAnchor({ x: 0, y: 0 })).toBe(true);
    expect(isSheetAnchor({ x: 120.5, y: SHEET_ANCHOR_MAX })).toBe(true);
    for (const bad of [
      null,
      'x',
      { x: -1, y: 0 },
      { x: 0, y: SHEET_ANCHOR_MAX + 1 },
      { x: Number.NaN, y: 0 },
      { x: Infinity, y: 0 },
      { x: '1', y: 0 },
      { x: 0 },
      { x: 0, y: 0, z: 0 },
    ])
      expect(isSheetAnchor(bad)).toBe(false);
    const chart = {
      ...createShape('bar-chart', 0, 0),
      chartSource: { sheetId: 'sheet0001', range },
    };
    expect(shapeValidationIssue({ ...chart, sheetAnchor: { x: 10, y: 20 } })).toBeNull();
    expect(shapeValidationIssue({ ...chart, sheetAnchor: { x: -5, y: 20 } })?.field).toBe(
      'sheetAnchor',
    );
  });

  it('is drawn by its Sheet only while the Sheet is on its tab', () => {
    const sheet = {
      ...createShape('plan-sheet', 0, 0),
      id: 's',
      planSheet: { sheetId: 'sheet0001' },
    };
    const chart = (id: string, sheetId: string, anchored = true) => ({
      ...createShape('bar-chart', 0, 0),
      id,
      chartSource: { sheetId, range },
      ...(anchored ? { sheetAnchor: { x: 0, y: 0 } } : {}),
    });
    const inSheet = chart('in', 'sheet0001');
    const floating = chart('floating', 'sheet0001', false);
    const orphan = chart('orphan', 'sheet0002');
    const els = [sheet, inSheet, floating, orphan, createShape('square', 0, 0)];
    expect([...sheetDrawnChartIds(els as never)]).toEqual(['in']);
    expect(sheetDrawnChartIds([sheet] as never).size).toBe(0);
    expect(sheetDrawnChartIds([orphan] as never).size).toBe(0);
    expect(chartsInSheet(els as never, 'sheet0001')).toEqual([inSheet]);
    expect(isSheetAnchoredChart(floating as never)).toBe(false);
    expect(isSheetAnchoredChart({ ...inSheet, chartSource: undefined } as never)).toBe(false);
  });

  it('always moves with its Sheet when anchored in it, wherever its own place is', () => {
    const sheet = {
      ...createShape('plan-sheet', 0, 0),
      id: 's',
      planSheet: { sheetId: 'sheet0001' },
    };
    const far = {
      ...createShape('bar-chart', 9000, 9000),
      id: 'far',
      chartSource: { sheetId: 'sheet0001', range },
      sheetAnchor: { x: 0, y: 0 },
    };
    const otherSheet = { ...far, id: 'other', chartSource: { sheetId: 'sheet0002', range } };
    expect([...withSheetCharts([sheet, far, otherSheet] as never, new Set(['s']))].sort()).toEqual([
      'far',
      's',
    ]);
  });

  it('takes only its anchored charts when asked (a delete), leaving a floating chart over it', () => {
    const sheet = {
      ...createShape('plan-sheet', 0, 0),
      id: 's',
      planSheet: { sheetId: 'sheet0001' },
    };
    const anchored = {
      ...createShape('bar-chart', 9000, 9000),
      id: 'anchored',
      chartSource: { sheetId: 'sheet0001', range },
      sheetAnchor: { x: 0, y: 0 },
    };
    const floating = {
      ...createShape('bar-chart', 20, 10),
      id: 'floating',
      chartSource: { sheetId: 'sheet0001', range },
    };
    expect(
      [
        ...withSheetCharts([sheet, anchored, floating] as never, new Set(['s']), {
          anchoredOnly: true,
        }),
      ].sort(),
    ).toEqual(['anchored', 's']);
  });
});
