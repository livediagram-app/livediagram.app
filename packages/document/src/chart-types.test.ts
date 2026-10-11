import { describe, expect, it } from 'vitest';
import {
  CHART_TYPES,
  chartShapeOf,
  chartTypeChange,
  chartTypeOf,
  isChartType,
  isChartVariant,
  lineVariantOf,
  variantFitsKind,
} from './chart-types';
import { createShape } from './shape-factory';
import { normaliseElement } from './element-normalise';
import { shapeValidationIssue } from './validate-shape';

describe('chart types (docs/specs/009-elements/pie-chart.md "Chart types")', () => {
  it('round-trips every type through its kind and variant', () => {
    for (const type of CHART_TYPES) expect(chartTypeOf(chartShapeOf(type))).toBe(type);
  });

  it('reads a chart made before chart types as its kind’s first type', () => {
    expect(chartTypeOf({ shape: 'bar-chart' })).toBe('column');
    expect(chartTypeOf({ shape: 'line-chart' })).toBe('line');
    expect(chartTypeOf({ shape: 'pie-chart' })).toBe('pie');
  });

  it('ignores a variant its kind does not take', () => {
    expect(chartTypeOf({ shape: 'pie-chart', chartVariant: 'area' })).toBe('pie');
    expect(chartTypeOf({ shape: 'bar-chart', chartVariant: 'nonsense' })).toBe('column');
    expect(variantFitsKind('line-chart', 'doughnut')).toBe(false);
    expect(variantFitsKind('line-chart', 'scatter')).toBe(true);
    expect(variantFitsKind('rectangle', 'area')).toBe(false);
  });

  it('is not a chart type for a non-chart', () => {
    expect(chartTypeOf({ shape: 'rectangle' })).toBeNull();
    expect(chartTypeChange({ shape: 'rectangle' }, 'pie')).toBeNull();
  });

  it('names how a line chart draws', () => {
    expect(lineVariantOf({ shape: 'line-chart' })).toBe('line');
    expect(lineVariantOf({ shape: 'line-chart', chartVariant: 'area' })).toBe('area');
    expect(lineVariantOf({ shape: 'line-chart', chartVariant: 'scatter' })).toBe('scatter');
    expect(lineVariantOf({ shape: 'pie-chart', chartVariant: 'doughnut' })).toBe('line');
  });

  it('guards its closed sets', () => {
    expect(isChartType('doughnut')).toBe(true);
    expect(isChartType('radar')).toBe(false);
    expect(isChartVariant('horizontal')).toBe(true);
    expect(isChartVariant('column')).toBe(false);
  });

  describe('chartTypeChange', () => {
    const slices = [
      { label: 'A', value: 4, color: '#ff0000' },
      { label: 'B', value: -2 },
    ];

    it('does nothing to a chart already of that type', () => {
      expect(chartTypeChange({ shape: 'pie-chart' }, 'pie')).toBeNull();
    });

    it('only sets the variant within a kind', () => {
      expect(chartTypeChange({ shape: 'bar-chart', pieSlices: slices }, 'bar')).toEqual({
        shape: 'bar-chart',
        chartVariant: 'horizontal',
      });
      expect(chartTypeChange({ shape: 'line-chart', chartVariant: 'area' }, 'line')).toEqual({
        shape: 'line-chart',
        chartVariant: undefined,
      });
    });

    it('turns slices into one series, dropping their colours', () => {
      expect(chartTypeChange({ shape: 'bar-chart', pieSlices: slices }, 'area')).toEqual({
        shape: 'line-chart',
        chartVariant: 'area',
        pieSlices: undefined,
        lineCategories: ['A', 'B'],
        lineSeries: [{ name: 'Series 1', values: [4, -2] }],
      });
    });

    it('leaves an empty chart to draw its new kind’s sample data', () => {
      expect(chartTypeChange({ shape: 'pie-chart' }, 'line')).toEqual({
        shape: 'line-chart',
        chartVariant: undefined,
        pieSlices: undefined,
      });
      expect(chartTypeChange({ shape: 'line-chart' }, 'column')).toEqual({
        shape: 'bar-chart',
        chartVariant: undefined,
        lineCategories: undefined,
        lineSeries: undefined,
      });
    });

    it('turns a line chart’s first series into slices, a pie never below zero', () => {
      const line = {
        shape: 'line-chart',
        lineCategories: ['Jan', 'Feb', 'Mar'],
        lineSeries: [
          { name: 'S1', values: [3, -1] },
          { name: 'S2', values: [9, 9, 9] },
        ],
      };
      expect(chartTypeChange(line, 'doughnut')).toEqual({
        shape: 'pie-chart',
        chartVariant: 'doughnut',
        pieSlices: [
          { label: 'Jan', value: 3 },
          { label: 'Feb', value: 0 },
          { label: 'Mar', value: 0 },
        ],
        lineCategories: undefined,
        lineSeries: undefined,
      });
      expect(chartTypeChange(line, 'bar')?.pieSlices?.[1]).toEqual({ label: 'Feb', value: -1 });
    });

    it('clamps a bar chart’s negatives when it becomes a pie, and keeps them otherwise', () => {
      expect(chartTypeChange({ shape: 'bar-chart', pieSlices: slices }, 'pie')?.pieSlices).toEqual([
        { label: 'A', value: 4, color: '#ff0000' },
        { label: 'B', value: 0 },
      ]);
      expect(
        chartTypeChange({ shape: 'pie-chart', pieSlices: [{ label: 'A', value: 1 }] }, 'column'),
      ).toEqual({ shape: 'bar-chart', chartVariant: undefined });
    });
  });

  it('validates and normalises the stored variant', () => {
    const pie = { ...createShape('pie-chart', 0, 0), chartVariant: 'doughnut' as const };
    expect(shapeValidationIssue(pie)).toBeNull();
    expect(shapeValidationIssue({ ...pie, chartVariant: 'radar' })).not.toBeNull();
    expect((normaliseElement(pie) as typeof pie).chartVariant).toBe('doughnut');
    const dropped = normaliseElement({ ...pie, chartVariant: 'area' }) as Record<string, unknown>;
    expect(dropped.chartVariant).toBeUndefined();
  });
});
