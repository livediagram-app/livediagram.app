// Show Values (docs/specs/009-elements/pie-chart.md): where each mark's number sits and what it reads, laid out once
// for both renderers, as chart-marks.ts lays out the marks. Pure.

import type { BarMarks, LineMarks, PieMarks } from './chart-marks';
import type { LineSeries, PieSlice } from './data-shapes';
import type { ShapeElement } from './element-types';
import { glyphWidth } from './glyph-width';
import { legendFontPx } from '@liveworkspace/model-core/label-font';

export type ChartValueLabel = {
  x: number;
  y: number;
  text: string;
  anchor: 'start' | 'middle' | 'end';
  // On a wedge: drawn in the ink that reads on that wedge's colour; otherwise in the chart's text colour.
  onMark?: number;
  // A column's name under its baseline, rather than a number.
  category?: boolean;
};

// A value's size: a step under the key's, never under 9px.
export const chartValueFontPx = (textSize: ShapeElement['textSize']) =>
  Math.max(9, Math.round(legendFontPx(textSize) * 0.85));

// How far a number stands off its mark.
const GAP = 6;
// The air kept between two columns' names, in px.
const CATEGORY_AIR = 4;

// A number read short: 120000 as 120k, 1500000 as 1.5M, at most one decimal. Under 10,000 it reads in full (1,080),
// since "1.1k" twice told 1,080 from 1,150 not at all.
export function shortNumber(v: number): string {
  const a = Math.abs(v);
  if (a < 1e4) return Number(v.toFixed(1)).toLocaleString('en-US');
  // The unit after rounding, so 999,960 reads 1M, not 1000k.
  const short = (div: number) => Number((v / div).toFixed(1));
  if (a >= 1e9 || Math.abs(short(1e6)) >= 1000) return `${short(1e9)}B`;
  if (a >= 1e6 || Math.abs(short(1e3)) >= 1000) return `${short(1e6)}M`;
  return `${short(1e3)}k`;
}

// A column's name cut to its slot, with an ellipsis, so neighbours never overprint; null when the slot holds not even
// one letter and the ellipsis.
function fitCategory(text: string, room: number, fontPx: number): string | null {
  if (glyphWidth(text, fontPx) <= room) return text;
  const chars = [...text];
  for (let n = chars.length - 1; n >= 1; n--) {
    const cut = `${chars.slice(0, n).join('').trimEnd()}…`;
    if (glyphWidth(cut, fontPx) <= room) return cut;
  }
  return null;
}

export function barValueLabels(
  marks: BarMarks,
  data: readonly PieSlice[],
  horizontal: boolean,
  fontPx: number,
): ChartValueLabel[] {
  const out: ChartValueLabel[] = [];
  // Each column's share of the baseline, less a little air between neighbours' names.
  const slot =
    (marks.baseline.x2 - marks.baseline.x1) / Math.max(1, marks.bars.length) - CATEGORY_AIR;
  marks.bars.forEach((bar, i) => {
    const d = data[i];
    if (!d) return;
    out.push(
      horizontal
        ? {
            x: bar.tip.x + GAP,
            y: bar.tip.y + fontPx * 0.35,
            text: shortNumber(d.value),
            anchor: 'start',
          }
        : { x: bar.tip.x, y: bar.tip.y - GAP, text: shortNumber(d.value), anchor: 'middle' },
    );
    // A column names itself under the baseline, so the legend can go; cut to its slot.
    const name = horizontal ? null : fitCategory(d.label, slot, fontPx);
    if (name !== null)
      out.push({
        x: bar.tip.x,
        y: marks.baseline.y1 + GAP + fontPx,
        text: name,
        anchor: 'middle',
        category: true,
      });
  });
  return out;
}

export function pieValueLabels(
  marks: PieMarks,
  data: readonly PieSlice[],
  fontPx: number,
): ChartValueLabel[] {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  const percent = Math.abs(total - 100) < 0.5;
  return marks.wedges.flatMap((w, i) => {
    const d = data[i];
    if (!d || d.value <= 0) return [];
    return [
      {
        x: w.tip.x,
        y: w.tip.y + fontPx * 0.35,
        text: percent ? `${Number(d.value.toFixed(1))}%` : shortNumber(d.value),
        anchor: 'middle' as const,
        onMark: i,
      },
    ];
  });
}

export function lineValueLabels(
  marks: LineMarks,
  series: readonly LineSeries[],
): ChartValueLabel[] {
  return marks.points.flatMap((pts, s) =>
    pts.flatMap((p, i) => {
      const v = series[s]?.values[i];
      return typeof v === 'number' && Number.isFinite(v)
        ? [{ x: p.x, y: p.y - marks.dot - GAP, text: shortNumber(v), anchor: 'middle' as const }]
        : [];
    }),
  );
}
