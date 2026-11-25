// A chart's data made safe to author (docs/specs/009-elements/pie-chart.md), the chart step of every product's
// element normaliser. Input is untrusted JSON: a value that is not a number reads as 0, a label or a name that is
// not text reads as text, and a series is fitted to the categories.

import { asText } from '@liveworkspace/model-core/as-text';
import { isRecord } from '@liveworkspace/model-core/is-record';
import { variantFitsKind } from './chart-types';

type Raw = Record<string, unknown>;

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function normaliseChart(el: Raw): Raw {
  const out = { ...el };
  // A variant its kind does not take (pie-chart.md "Chart types") draws as the kind's first type anyway; dropped,
  // so what is stored says what is drawn.
  if (out.chartVariant !== undefined && !variantFitsKind(String(el.shape), out.chartVariant))
    delete out.chartVariant;
  // Only a pie stops at zero: a column or bar chart draws below it (pie-chart.md "Below zero on a column or bar
  // chart"), so an agent's negative, or one already stored, is kept.
  const floor = el.shape === 'pie-chart' ? 0 : -Infinity;
  if (Array.isArray(el.pieSlices))
    out.pieSlices = el.pieSlices.filter(isRecord).map((s) => ({
      ...s,
      label: asText(s.label),
      value: Math.max(floor, num(s.value)),
    }));
  if (Array.isArray(el.lineCategories)) out.lineCategories = el.lineCategories.map(asText);
  if (Array.isArray(el.lineSeries)) {
    const count = Array.isArray(out.lineCategories) ? out.lineCategories.length : undefined;
    out.lineSeries = el.lineSeries.filter(isRecord).map((s) => {
      const values = Array.isArray(s.values) ? s.values.map(num) : [];
      const fitted =
        count === undefined ? values : Array.from({ length: count }, (_, i) => values[i] ?? 0);
      // A second axis is `right` or nothing.
      const { axis, ...rest } = s;
      return {
        ...rest,
        name: asText(s.name),
        values: fitted,
        ...(axis === 'right' ? { axis } : {}),
      };
    });
  }
  return out;
}
