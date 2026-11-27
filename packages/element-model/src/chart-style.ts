// How a chart's marks are drawn (docs/specs/009-elements/pie-chart.md "How a chart is drawn"): the sizes, the
// geometry and the quiet chrome every chart type shares, so a chart dropped on a slide looks finished without a
// change from anyone. One copy for the canvas views and the exporter, so the two draw the same chart. Pure; nothing
// here is stored, so every chart, old or new, draws this way.

import { AXIS_TICK_FONT_PX } from './chart-axis';
import { chartValueFontPx } from './chart-values';
import type { ShapeElement } from './element';
import { legendFontPx } from '@liveworkspace/model-core/label-font';

// The chrome is the chart's own text colour, faded, so it is recessive on every theme and every page, light or dark,
// where fixed slate greys glared on a dark page and vanished on a grey one. The baseline the marks grow from is a
// step firmer than the gridlines across the plot.
export const CHART_BASELINE_OPACITY = 0.35;
export const CHART_GRID_OPACITY = 0.12;

// An area chart's fill: the series colour fading from the line down to the baseline, so the line leads and the
// overlapping areas stay readable through each other.
export const AREA_FILL_TOP_OPACITY = 0.32;
export const AREA_FILL_FOOT_OPACITY = 0.03;

type Sized = Pick<ShapeElement, 'textSize' | 'width' | 'height'>;

// A chart's text grows with the chart, as a slide's chart is read from across a room (pie-chart.md "How a chart is
// drawn"). Its Text Size is the size at the board default (a short side of CHART_TEXT_BASE_SIDE px); a bigger chart
// scales all of its text, the key, the numbers and the axis, by its short side over that, eased (to the power
// CHART_TEXT_GROWTH) so a slide-filling chart's text reads like a slide's body, not a poster's. Never under 1: a chart
// smaller than the default keeps its Text Size.
export const CHART_TEXT_BASE_SIDE = 240;
export const CHART_TEXT_GROWTH = 0.6;
export function chartTextScale(element: Pick<ShapeElement, 'width' | 'height'>): number {
  const short = Math.min(element.width, element.height);
  return Math.max(1, (short / CHART_TEXT_BASE_SIDE) ** CHART_TEXT_GROWTH);
}

// The key's row size: its Text Size (legendFontPx), grown with the chart.
export function chartLegendPx(element: Sized): number {
  return Math.round(legendFontPx(element.textSize) * chartTextScale(element));
}

// A mark's number (Show Values): a step under the key, grown with the chart.
export function chartValuePx(element: Sized): number {
  return Math.round(chartValueFontPx(element.textSize) * chartTextScale(element));
}

// The axis and category labels: a fifth under the key, never under the 9px floor, grown with the chart.
export function chartTickPx(element: Sized): number {
  return Math.max(
    AXIS_TICK_FONT_PX,
    Math.round(legendFontPx(element.textSize) * 0.8 * chartTextScale(element)),
  );
}

// A line's weight grows with its plot, from 2px on a small chart to 3.5px on a slide-sized one.
export function chartLineWidth(w: number, h: number): number {
  return Math.round(Math.max(2, Math.min(3.5, Math.min(w, h) / 110)) * 100) / 100;
}

// Two decimals, as every exported coordinate carries (svg-render-primitives `r2`).
const q = (n: number) => Math.round(n * 100) / 100;

type Pt = { x: number; y: number };

const sign = (n: number) => (n < 0 ? -1 : n > 0 ? 1 : 0);

// A smooth line through `pts` that never overshoots a point (a monotone cubic, as d3's curveMonotoneX draws it): a
// peak stays the peak and a flat run stays flat, so the curve never claims a value the data does not hold. Points
// run left to right; a point sharing its neighbour's x keeps a straight join.
export function smoothPath(pts: readonly Pt[]): string {
  const n = pts.length;
  if (n === 0) return '';
  const first = pts[0]!;
  if (n < 3)
    return `M ${q(first.x)} ${q(first.y)}${n === 2 ? ` L ${q(pts[1]!.x)} ${q(pts[1]!.y)}` : ''}`;
  // Each segment's slope, then each point's tangent: zero at a turn, else the gentlest that keeps it monotone.
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1]!.x - pts[i]!.x;
    slope.push(dx === 0 ? 0 : (pts[i + 1]!.y - pts[i]!.y) / dx);
  }
  const tangent: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i++) {
    const h0 = pts[i]!.x - pts[i - 1]!.x;
    const h1 = pts[i + 1]!.x - pts[i]!.x;
    const s0 = slope[i - 1]!;
    const s1 = slope[i]!;
    const p = h0 + h1 === 0 ? 0 : (s0 * h1 + s1 * h0) / (h0 + h1);
    tangent.push((sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)));
  }
  tangent.push(slope[n - 2]!);
  let d = `M ${q(first.x)} ${q(first.y)}`;
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const third = (b.x - a.x) / 3;
    d += ` C ${q(a.x + third)} ${q(a.y + third * tangent[i]!)} ${q(b.x - third)} ${q(b.y - third * tangent[i + 1]!)} ${q(b.x)} ${q(b.y)}`;
  }
  return d;
}

// Which end of a bar its value is at: a column's top (its foot below zero), a bar's right (its left below zero).
export type BarEnd = 'top' | 'bottom' | 'left' | 'right';

// A bar's outline, its value end rounded and its baseline end square, so every bar reads as growing from the one
// baseline. The radius is a share of its thickness (2px at least), so a wide slide bar is as round as a slim one, and
// at most half its length, so a short bar is never a pill.
const BAR_ROUNDING = 0.14;
export function barPath(x: number, y: number, w: number, h: number, end: BarEnd): string {
  const thick = end === 'top' || end === 'bottom' ? w : h;
  const long = end === 'top' || end === 'bottom' ? h : w;
  const r = Math.max(0, Math.min(Math.max(2, thick * BAR_ROUNDING), thick / 2, long));
  const x1 = x + w;
  const y1 = y + h;
  const arc = (tx: number, ty: number) => `A ${q(r)} ${q(r)} 0 0 1 ${q(tx)} ${q(ty)}`;
  if (r === 0) return `M ${q(x)} ${q(y)} H ${q(x1)} V ${q(y1)} H ${q(x)} Z`;
  switch (end) {
    case 'top':
      return `M ${q(x)} ${q(y1)} V ${q(y + r)} ${arc(x + r, y)} H ${q(x1 - r)} ${arc(x1, y + r)} V ${q(y1)} Z`;
    case 'bottom':
      return `M ${q(x1)} ${q(y)} V ${q(y1 - r)} ${arc(x1 - r, y1)} H ${q(x + r)} ${arc(x, y1 - r)} V ${q(y)} Z`;
    case 'right':
      return `M ${q(x)} ${q(y)} H ${q(x1 - r)} ${arc(x1, y + r)} V ${q(y1 - r)} ${arc(x1 - r, y1)} H ${q(x)} Z`;
    case 'left':
      return `M ${q(x1)} ${q(y1)} H ${q(x + r)} ${arc(x, y1 - r)} V ${q(y + r)} ${arc(x + r, y)} H ${q(x1)} Z`;
  }
}

// The id of an area's fade, unique to its chart and series so many charts on one page or in one export never borrow
// each other's. An element id may hold any character, so only its safe ones are kept, with its length to tell apart
// two ids that differ only in the dropped ones.
export function areaFadeId(elementId: string, series: number): string {
  return `chart-fade-${elementId.replace(/[^A-Za-z0-9_-]/g, '')}-${elementId.length}-${series}`;
}
