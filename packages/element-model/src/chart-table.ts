// A table a chart is drawn from (liveplanner docs/specs/029-sheets/sheet.md "Charts"; livedocuments
// docs/specs/009-elements/pie-chart.md "Charts linked to a liveplanner sheet"): one category per row, one series per
// value column, as a sheet range reads. Shared by a liveplanner chart reading its own plan's Sheet and a livedocuments
// chart reading one through the index. Pure.
import type { LineSeries, PieSlice } from './data-shapes';
import { chartTypeOf } from './chart-types';

export type ChartTable = {
  categories: string[];
  series: { name: string; values: number[] }[];
};

type ChartFields = {
  shape: string;
  chartVariant?: unknown;
  pieSlices?: PieSlice[];
  lineSeries?: LineSeries[];
};

// Whether a read numbered its categories (`1, 2, …`), as it does when the range's first column is not labels.
const numbered = (categories: readonly string[]) => categories.every((c, i) => c === String(i + 1));

// The data fields a table gives a chart, keeping the colours its slices or series already carry (by position).
// A pie or bar chart reads the first series (a pie never below zero); a line, area or scatter chart reads them all.
// A scatter chart whose first column held numbers (the read numbered its categories and made that column a series)
// takes that column as its x.
export function chartFieldsFromTable(
  el: ChartFields,
  t: ChartTable,
): { pieSlices: PieSlice[] } | { lineCategories: string[]; lineSeries: LineSeries[] } {
  if (el.shape === 'line-chart') {
    const xFromFirst =
      chartTypeOf(el) === 'scatter' && t.series.length >= 2 && numbered(t.categories);
    const categories = xFromFirst ? t.series[0]!.values.map(String) : t.categories;
    const series = xFromFirst ? t.series.slice(1) : t.series;
    return {
      lineCategories: categories,
      lineSeries: series.map((s, i) => {
        const color = el.lineSeries?.[i]?.color;
        return { name: s.name, values: s.values, ...(color ? { color } : {}) };
      }),
    };
  }
  const first = t.series[0]?.values ?? [];
  return {
    pieSlices: t.categories.map((label, i) => {
      const color = el.pieSlices?.[i]?.color;
      const v = first[i] ?? 0;
      return {
        label,
        value: el.shape === 'pie-chart' ? Math.max(0, v) : v,
        ...(color ? { color } : {}),
      };
    }),
  };
}
