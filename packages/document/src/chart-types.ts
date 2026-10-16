// Chart types (docs/specs/009-elements/pie-chart.md "Chart types"): how a chart draws its data, named as Google
// Sheets names it. Each is a chart kind (the stored `shape`) and, for all but the first of its kind, a
// `chartVariant`, so every chart made before chart types keeps drawing as it did.
import type { LineSeries, PieSlice } from './data-shapes';

export const CHART_TYPES = ['column', 'bar', 'line', 'area', 'scatter', 'pie', 'doughnut'] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export const CHART_VARIANTS = ['horizontal', 'area', 'scatter', 'doughnut'] as const;
export type ChartVariant = (typeof CHART_VARIANTS)[number];

export type ChartKind = 'bar-chart' | 'line-chart' | 'pie-chart';

// Each type's kind and variant, in CHART_TYPES order.
const SHAPES: Record<ChartType, { shape: ChartKind; chartVariant?: ChartVariant }> = {
  column: { shape: 'bar-chart' },
  bar: { shape: 'bar-chart', chartVariant: 'horizontal' },
  line: { shape: 'line-chart' },
  area: { shape: 'line-chart', chartVariant: 'area' },
  scatter: { shape: 'line-chart', chartVariant: 'scatter' },
  pie: { shape: 'pie-chart' },
  doughnut: { shape: 'pie-chart', chartVariant: 'doughnut' },
};

// The names people see ("Column", and "Column Chart" in a menu that inserts one).
export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  column: 'Column',
  bar: 'Bar',
  line: 'Line',
  area: 'Area',
  scatter: 'Scatter',
  pie: 'Pie',
  doughnut: 'Doughnut',
};

export function isChartType(v: unknown): v is ChartType {
  return (CHART_TYPES as readonly unknown[]).includes(v);
}

export function isChartVariant(v: unknown): v is ChartVariant {
  return (CHART_VARIANTS as readonly unknown[]).includes(v);
}

const isChartKind = (shape: string): shape is ChartKind =>
  shape === 'bar-chart' || shape === 'line-chart' || shape === 'pie-chart';

// Whether a kind takes a variant: one it does not take draws as the kind's first type.
export function variantFitsKind(shape: string, variant: unknown): boolean {
  if (!isChartKind(shape) || !isChartVariant(variant)) return false;
  return Object.values(SHAPES).some((s) => s.shape === shape && s.chartVariant === variant);
}

// The type a chart draws as; null for an element that is not a chart.
export function chartTypeOf(el: { shape: string; chartVariant?: unknown }): ChartType | null {
  if (!isChartKind(el.shape)) return null;
  const fits = variantFitsKind(el.shape, el.chartVariant) ? el.chartVariant : undefined;
  const found = CHART_TYPES.find(
    (t) => SHAPES[t].shape === el.shape && SHAPES[t].chartVariant === fits,
  );
  return found ?? null;
}

// The kind and variant a type is stored as.
export function chartShapeOf(type: ChartType): { shape: ChartKind; chartVariant?: ChartVariant } {
  return SHAPES[type];
}

type ChartData = {
  shape: string;
  chartVariant?: unknown;
  pieSlices?: PieSlice[];
  lineCategories?: string[];
  lineSeries?: LineSeries[];
};

export type ChartTypePatch = {
  shape: ChartKind;
  chartVariant: ChartVariant | undefined;
  pieSlices?: PieSlice[] | undefined;
  lineCategories?: string[] | undefined;
  lineSeries?: LineSeries[] | undefined;
};

// The patch that makes `el` draw as `type` (spec "Changing type"): within a kind only the variant; across kinds
// the data moves too, slices to one series named Series 1, or a line chart's first series to slices. Null when
// `el` is not a chart or already is that type.
export function chartTypeChange(el: ChartData, type: ChartType): ChartTypePatch | null {
  const from = chartTypeOf(el);
  if (!from || from === type) return null;
  const to = SHAPES[type];
  const patch: ChartTypePatch = { shape: to.shape, chartVariant: to.chartVariant };
  if (to.shape === el.shape) return patch;
  if (to.shape === 'line-chart') {
    // Only when the chart has data of its own: an empty one draws the line chart's sample data, as a new one does.
    if (el.pieSlices?.length) {
      patch.lineCategories = el.pieSlices.map((s) => s.label);
      patch.lineSeries = [{ name: 'Series 1', values: el.pieSlices.map((s) => s.value) }];
    }
    patch.pieSlices = undefined;
    return patch;
  }
  if (el.shape === 'line-chart') {
    const first = el.lineSeries?.[0]?.values;
    if (el.lineCategories?.length && first) {
      patch.pieSlices = el.lineCategories.map((label, i) => {
        const v = first[i] ?? 0;
        return { label, value: to.shape === 'pie-chart' ? Math.max(0, v) : v };
      });
    }
    patch.lineCategories = undefined;
    patch.lineSeries = undefined;
    return patch;
  }
  // Pie and bar share their slices; a pie never draws below zero.
  if (to.shape === 'pie-chart' && el.pieSlices?.some((s) => s.value < 0))
    patch.pieSlices = el.pieSlices.map((s) => ({ ...s, value: Math.max(0, s.value) }));
  return patch;
}

// How a line chart draws: as a line, an area or a scatter (its chart type, read for the line kind's renderers).
export function lineVariantOf(el: {
  shape: string;
  chartVariant?: unknown;
}): 'line' | 'area' | 'scatter' {
  const type = chartTypeOf(el);
  return type === 'area' || type === 'scatter' ? type : 'line';
}
