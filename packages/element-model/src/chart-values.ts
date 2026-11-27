// Show Values (docs/specs/009-elements/pie-chart.md): where each mark's number sits and what it reads, laid out once
// for both renderers, as chart-marks.ts lays out the marks. Pure.

import type { BarMarks, LineMarks, PieMarks } from './chart-marks';
import type { LineSeries, PieSlice } from './data-shapes';
import type { ShapeElement } from './element';
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
// since "1.1k" twice told 1,080 from 1,150 not at all, with `decimals` (an axis's fine step asks for more). A value
// rounding to nothing reads 0, never -0.
export function shortNumber(v: number, decimals = 1): string {
  const a = Math.abs(v);
  if (a < 1e4)
    return (Number(v.toFixed(decimals)) + 0).toLocaleString('en-US', {
      maximumFractionDigits: decimals,
    });
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
  marks.bars.forEach((bar, i) => {
    const d = data[i];
    if (!d) return;
    // A value below zero reads past its column's foot (left of its bar), as a positive one reads past its end
    // (docs/specs/009-elements/pie-chart.md "Below zero on a column or bar chart").
    const below = d.value < 0;
    out.push(
      horizontal
        ? {
            x: below ? bar.tip.x - GAP : bar.tip.x + GAP,
            y: bar.tip.y + fontPx * 0.35,
            text: shortNumber(d.value),
            anchor: below ? 'end' : 'start',
          }
        : {
            x: bar.tip.x,
            y: below ? bar.tip.y + GAP + fontPx : bar.tip.y - GAP,
            text: shortNumber(d.value),
            anchor: 'middle',
          },
    );
  });
  return out;
}

/** Each bar's name on its axis (pie-chart.md "How a chart is drawn"), always, as a one-hue chart names its bars there
 *  rather than in a key: under a column, below the plot's foot (a row lower when a column hangs to it, its number
 *  taking the first), or left of a bar, right-aligned against the plot. Cut to its room with an ellipsis; dropped
 *  when not one letter fits. */
export function barCategoryLabels(
  marks: BarMarks,
  data: readonly PieSlice[],
  horizontal: boolean,
  fontPx: number,
): ChartValueLabel[] {
  const out: ChartValueLabel[] = [];
  const hangs = data.some((d) => d.value < 0);
  const nameY = marks.floor + GAP + fontPx + (hangs ? GAP + fontPx * 1.2 : 0);
  const room = horizontal ? marks.nameRoom : marks.nameRoom - CATEGORY_AIR;
  marks.bars.forEach((bar, i) => {
    const d = data[i];
    if (!d) return;
    const name = fitCategory(d.label, room, fontPx);
    if (name === null) return;
    out.push(
      horizontal
        ? {
            x: marks.floor - GAP,
            y: bar.tip.y + fontPx * 0.35,
            text: name,
            anchor: 'end',
            category: true,
          }
        : { x: bar.tip.x, y: nameY, text: name, anchor: 'middle', category: true },
    );
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

/** A line, area or scatter chart's numbers, thinned so none overprints another: each series' end first (its latest
 *  value), then its highest and lowest, then every other point in order, each kept only where its box stays clear of
 *  every box already kept. A slide's line of twelve months reads its story, not a wall of numbers. */
export function lineValueLabels(
  marks: LineMarks,
  series: readonly LineSeries[],
  fontPx = 12,
): ChartValueLabel[] {
  type Box = { l: number; r: number; t: number; b: number };
  const kept: Box[] = [];
  const out: ChartValueLabel[] = [];
  const order: { s: number; i: number }[] = [];
  marks.points.forEach((pts, s) => {
    const vals = series[s]?.values ?? [];
    const finite = pts.map((_, i) => i).filter((i) => Number.isFinite(vals[i]));
    if (finite.length === 0) return;
    const by = (pick: (a: number, b: number) => boolean) =>
      finite.reduce((best, i) => (pick(vals[i]!, vals[best]!) ? i : best));
    const first = [finite[finite.length - 1]!, by((a, b) => a > b), by((a, b) => a < b)];
    for (const i of [...first, ...finite]) order.push({ s, i });
  });
  // A number never hangs past the plot's first or last point, where it would run into the axis or the edge.
  const xs = marks.points.flat().map((p) => p.x);
  const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
  const seen = new Set<string>();
  for (const { s, i } of order) {
    const key = `${s}:${i}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = marks.points[s]![i]!;
    const text = shortNumber(series[s]!.values[i]!);
    const y = p.y - marks.dot - GAP;
    const half = glyphWidth(text, fontPx) / 2 + 2;
    const x = Math.max(Math.min(p.x, hi - half + 2), lo + half - 2);
    const box = { l: x - half, r: x + half, t: y - fontPx, b: y + 2 };
    if (kept.some((k) => box.l < k.r && box.r > k.l && box.t < k.b && box.b > k.t)) continue;
    kept.push(box);
    out.push({ x, y, text, anchor: 'middle' });
  }
  return out;
}
