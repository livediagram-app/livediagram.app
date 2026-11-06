// What a chart shows, as text (docs/specs/009-elements/pie-chart.md "The text exports say what a chart shows"):
// a chart, a legend or a Sankey diagram carries no label, so the Markdown and Mermaid exports read its data
// instead. A heading naming its type, then one line per row of data.
import { isChartShape, isLegendShape, isLineShape } from './data-shapes';
import { elementKindLabel } from './element-kind-label';
import { isSankeyShape } from './sankey-model';
import type { Element } from './index';

export type ChartText = { heading: string; rows: string[] };

// A number as people write it: no trailing zeros, no float noise (0.1 + 0.2 reads 0.3).
function num(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(Number(v.toPrecision(12))) : '';
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

// The heading and rows for an element that draws data, or null for anything else.
export function chartTextLines(el: Element): ChartText | null {
  if (el.type !== 'shape') return null;
  const kind = el.shape;
  if (!isChartShape(kind) && !isLegendShape(kind) && !isSankeyShape(kind)) return null;
  const heading = elementKindLabel(el);
  const rows: string[] = [];
  if (isLineShape(kind)) {
    const cats = el.lineCategories ?? [];
    for (const s of el.lineSeries ?? []) {
      const values = (s.values ?? []).map((v, i) => {
        const cat = text(cats[i]);
        return cat ? `${cat} ${num(v)}` : num(v);
      });
      rows.push(`${text(s.name) || 'Series'}: ${values.join(', ')}`);
    }
  } else if (isChartShape(kind)) {
    for (const s of el.pieSlices ?? []) rows.push(`${text(s.label) || '?'}: ${num(s.value)}`);
  } else if (isLegendShape(kind)) {
    for (const item of el.legendItems ?? []) {
      const label = text(item.label);
      if (label) rows.push(label);
    }
  } else {
    for (const f of el.sankeyFlows ?? [])
      rows.push(`${text(f.from)} → ${text(f.to)}: ${num(f.value)}`);
  }
  return { heading, rows };
}
