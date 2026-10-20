import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { migrateIncomingTab } from './stored-tab';
import { elementValidationIssue, isValidTab } from './validate';
import { settleChartRows } from './malformed-chart-rows';
import { pieMarks } from './chart-marks';
import type { Element, ShapeElement, Tab } from './index';

// A chart's rows on the way in (docs/specs/009-elements/pie-chart.md "Model").
const chart = (kind: 'pie-chart' | 'line-chart', fields: Record<string, unknown>) =>
  ({ ...createShape(kind, 0, 0), ...fields }) as unknown as Element;

describe('settleChartRows', () => {
  it('hands well-formed charts back as they are', () => {
    const els = [createShape('pie-chart', 0, 0), createShape('line-chart', 0, 0)];
    expect(settleChartRows(els)).toBe(els);
  });

  it('drops a slice that is not one and gives a label text', () => {
    const [out] = settleChartRows([
      chart('pie-chart', {
        pieSlices: [null, { label: 7, value: 2 }, 'x', { label: 'A', value: 1 }],
      }),
    ]);
    expect((out as ShapeElement).pieSlices).toEqual([
      { label: '7', value: 2 },
      { label: 'A', value: 1 },
    ]);
  });

  it('keeps every category in its place and repairs the series', () => {
    const [out] = settleChartRows([
      chart('line-chart', {
        lineCategories: ['Jan', 2024, null, { a: 1 }, true],
        lineSeries: [undefined, { name: null, values: 'x' }, { name: 'S', values: [1, 2] }],
      }),
    ]);
    const el = out as ShapeElement;
    expect(el.lineCategories).toEqual(['Jan', '2024', '', '', 'true']);
    expect(el.lineSeries).toEqual([
      { name: '', values: [] },
      { name: 'S', values: [1, 2] },
    ]);
  });

  it('leaves a field that is not a list for validation to refuse', () => {
    const el = chart('pie-chart', { pieSlices: 'x' });
    expect(settleChartRows([el])[0]).toBe(el);
    expect(elementValidationIssue(el)?.field).toBe('pieSlices');
  });
});

describe('a malformed chart row on the way in', () => {
  it('is refused by validation', () => {
    expect(elementValidationIssue(chart('pie-chart', { pieSlices: [null] }))?.field).toBe(
      'pieSlices',
    );
    expect(
      elementValidationIssue(chart('line-chart', { lineSeries: [{ name: 'S' }] }))?.field,
    ).toBe('lineSeries');
    expect(elementValidationIssue(chart('line-chart', { lineCategories: [1] }))?.field).toBe(
      'lineCategories',
    );
  });

  it('is settled by the incoming-tab migration, so the tab validates and draws', () => {
    const tab = migrateIncomingTab({
      id: 't',
      name: 'T',
      elements: [chart('pie-chart', { pieSlices: [null, { label: 1, value: 3 }] })],
    }) as Tab;
    expect(isValidTab(tab)).toBe(true);
    const slices = (tab.elements[0] as ShapeElement).pieSlices!;
    expect(() => pieMarks({ x: 0, y: 0, w: 100, h: 100 }, slices, false)).not.toThrow();
  });
});
