// A chart's rows read the way its renderers read them, settled where stored elements enter
// (./stored-elements): from storage, a peer, a paste, a file or an agent's write
// (docs/specs/009-elements/pie-chart.md "Model"). The marks, the legend and the axis walk each
// slice and series as an object, each series' values as a list and each label, name and category
// as text, so a row that was not one threw in the canvas and every export. A row is repaired, not
// dropped, wherever dropping it would shift the line chart's categories against its values.

import type { Element } from './index';
import { asText } from '@liveworkspace/model-core/as-text';
import { isRecord } from '@liveworkspace/model-core/is-record';

/** Whether a pie or bar slice reads as one: an object with a text label. */
export function isChartSlice(v: unknown): boolean {
  return isRecord(v) && typeof v.label === 'string';
}

/** Whether a line series reads as one: an object with a text name and a list of values. */
export function isChartSeries(v: unknown): boolean {
  return isRecord(v) && typeof v.name === 'string' && Array.isArray(v.values);
}

/** Whether a line category reads as one: text. */
export function isChartCategory(v: unknown): boolean {
  return typeof v === 'string';
}

// Each field's row test and its repair (null drops the row: a slice or series stands alone, a
// category keeps its place).
const ROWS: readonly [string, (v: unknown) => boolean, (v: unknown) => unknown][] = [
  ['pieSlices', isChartSlice, (v) => (isRecord(v) ? { ...v, label: asText(v.label) } : null)],
  [
    'lineSeries',
    isChartSeries,
    (v) =>
      isRecord(v)
        ? { ...v, name: asText(v.name), values: Array.isArray(v.values) ? v.values : [] }
        : null,
  ],
  ['lineCategories', isChartCategory, asText],
];

/** The elements with every malformed chart row repaired or dropped; the same array when none had
 *  one. A field that is not a list is left for validation to refuse. */
export function settleChartRows(elements: Element[]): Element[] {
  let out: Element[] | null = null;
  elements.forEach((el, i) => {
    if (el.type !== 'shape') return;
    const raw = el as unknown as Record<string, unknown>;
    let next: Record<string, unknown> | null = null;
    for (const [field, ok, repair] of ROWS) {
      const rows: unknown = raw[field];
      if (!Array.isArray(rows) || rows.every(ok)) continue;
      next ??= { ...raw };
      next[field] = (rows as unknown[])
        .map((r): unknown => (ok(r) ? r : repair(r)))
        .filter((r) => r !== null);
    }
    if (!next) return;
    out ??= elements.slice();
    out[i] = next as unknown as Element;
  });
  return out ?? elements;
}
