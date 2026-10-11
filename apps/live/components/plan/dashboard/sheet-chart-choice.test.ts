import { describe, expect, it } from 'vitest';
import type { ShapeElement, Tab } from '@livediagram/document';
import { newSlotChart, sheetChartLabel, sheetChartsOf, slotChartFrom } from './sheet-chart-choice';
import { budgetSheet, SHEET_ID } from './sheet-chart-test-sheet';

// docs/specs/026-plan/plan-tabs.md "Sheet Chart".
const range = { r1: 'row0a', c1: 'colAa', r2: 'row2a', c2: 'colBa' };
const chart = (id: string, over: Partial<ShapeElement> = {}): ShapeElement =>
  ({
    id,
    type: 'shape',
    shape: 'bar-chart',
    x: 40,
    y: 60,
    width: 260,
    height: 220,
    chartSource: { sheetId: SHEET_ID, range },
    ...over,
  }) as ShapeElement;
const tab = (id: string, elements: unknown[], kind?: string) =>
  ({ id, name: id, kind, elements }) as unknown as Tab;

describe('a Sheet Chart', () => {
  it("lists a sheet's charts on every tab but a Dashboard, in tab order", () => {
    const tabs = [
      tab('a', [chart('a1'), chart('other', { chartSource: { sheetId: 'sheetBBBB', range } })]),
      tab('d', [chart('slot')], 'dashboard'),
      tab('b', [
        chart('b1', { sheetAnchor: { x: 1, y: 2 } }),
        chart('plain', { chartSource: undefined }),
      ]),
    ];
    expect(sheetChartsOf(tabs, SHEET_ID).map((c) => c.id)).toEqual(['a1', 'b1']);
  });

  it('names a chart by its type and the range it reads now', () => {
    const sheet = budgetSheet();
    expect(sheetChartLabel(chart('a'), sheet)).toBe('Column Chart · A1:B3');
    expect(sheetChartLabel(chart('p', { shape: 'pie-chart' }), sheet)).toBe('Pie Chart · A1:B3');
    expect(
      sheetChartLabel(chart('d', { shape: 'line-chart', chartVariant: 'scatter' }), sheet),
    ).toBe('Scatter Chart · A1:B3');
    const gone = chart('g', {
      chartSource: { sheetId: SHEET_ID, range: { ...range, r1: 'gone0' } },
    });
    expect(sheetChartLabel(gone, sheet)).toBe('Column Chart');
  });

  it('copies a chart as an element of its own, reading the same cells, leaving its place behind', () => {
    const src = chart('a', {
      shape: 'line-chart',
      sheetAnchor: { x: 10, y: 10 },
      layerId: 'layer',
      locked: true,
      chartLegend: false,
      chartPalette: 'ocean',
    } as Partial<ShapeElement>);
    const copy = slotChartFrom(src);
    expect(copy.id).not.toBe('a');
    expect(copy).toMatchObject({
      shape: 'line-chart',
      x: 0,
      y: 0,
      chartSource: src.chartSource,
      chartLegend: false,
      chartPalette: 'ocean',
    });
    expect(copy.sheetAnchor).toBeUndefined();
    expect(copy.layerId).toBeUndefined();
    expect(copy.locked).toBeUndefined();
  });

  it('makes a new chart over a range typed as A1, or nothing for one that is not on the sheet', () => {
    const sheet = budgetSheet();
    expect(newSlotChart(sheet, ' a1:b3 ', 'pie')).toMatchObject({
      shape: 'pie-chart',
      chartSource: { sheetId: SHEET_ID, range },
    });
    expect(newSlotChart(sheet, 'A1:B3', 'doughnut')).toMatchObject({
      shape: 'pie-chart',
      chartVariant: 'doughnut',
    });
    expect(newSlotChart(sheet, 'A1:B3', 'column')).not.toHaveProperty('chartVariant');
    expect(newSlotChart(sheet, 'A1:C3', 'column')).toBeNull();
    expect(newSlotChart(sheet, 'A1:B9', 'column')).toBeNull();
    expect(newSlotChart(sheet, 'rent', 'column')).toBeNull();
  });
});
