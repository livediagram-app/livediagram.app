// Every chart type's marks (docs/specs/009-elements/pie-chart.md "Chart types"), laid out once for both renderers:
// the canvas views draw them as React SVG, the exporter as SVG text. Before this each renderer worked the geometry
// out for itself, and a new chart type would have had to be drawn the same way twice. Pure; `ox` / `oy` shift every
// point (the exporter draws in canvas coordinates, the views in the element's own).
import {
  AXIS_TICK_FONT_PX,
  AXIS_TICK_GAP,
  axisLabelRoom,
  axisScale,
  rightAxisSeries,
  type AxisScale,
} from './chart-axis';
import type { ChartRect } from './chart-frame';
import { chartAxisLabel } from './chart-frame';
import type { LineSeries, PieSlice } from './data-shapes';

export type ChartPoint = { x: number; y: number };

// Path text carries two decimals, as every exported coordinate does (svg-render-primitives `r2`).
const q = (n: number) => Math.round(n * 100) / 100;

// A doughnut's hole, as a share of its radius.
export const DOUGHNUT_HOLE = 0.55;

export type PieWedge = {
  // The wedge's outline; for a whole-circle datum of a plain pie, empty (draw a circle of `rad`).
  d: string;
  full: boolean;
  // Where its readout sits: the wedge's middle angle, half way into the slice (into the ring on a doughnut).
  tip: ChartPoint;
};

export type PieMarks = { cx: number; cy: number; rad: number; hole: number; wedges: PieWedge[] };

// Wedges clockwise from twelve o'clock; a doughnut's leave the middle open.
export function pieMarks(
  area: ChartRect,
  data: readonly PieSlice[],
  doughnut: boolean,
  ox = 0,
  oy = 0,
): PieMarks {
  const total = data.reduce((sum, s) => sum + Math.max(0, s.value), 0) || 1;
  const rad = Math.max(10, (Math.min(area.w, area.h) * 0.86) / 2);
  const hole = doughnut ? rad * DOUGHNUT_HOLE : 0;
  const cx = ox + area.x + area.w / 2;
  const cy = oy + area.y + area.h / 2;
  const at = (r: number, a: number) => `${q(cx + r * Math.cos(a))} ${q(cy + r * Math.sin(a))}`;
  // The readout's radius: half way into the slice, or into the ring.
  const tipR = doughnut ? (rad + hole) / 2 : rad * 0.55;
  let angle = -Math.PI / 2;
  const wedges = data.map((s): PieWedge => {
    const frac = Math.max(0, s.value) / total;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const full = frac >= 0.999;
    const mid = full ? -Math.PI / 2 : (a0 + a1) / 2;
    const tip = { x: cx + tipR * Math.cos(mid), y: cy + tipR * Math.sin(mid) };
    if (full) {
      // An arc from a point back to itself draws nothing: a whole ring is two half rings, the hole cut out by the
      // even-odd rule; a whole pie is a circle the renderer draws.
      if (!doughnut) return { d: '', full, tip };
      const ring = (r: number) =>
        `M ${q(cx - r)} ${q(cy)} A ${q(r)} ${q(r)} 0 1 1 ${q(cx + r)} ${q(cy)} A ${q(r)} ${q(r)} 0 1 1 ${q(cx - r)} ${q(cy)} Z`;
      return { d: `${ring(rad)} ${ring(hole)}`, full, tip };
    }
    if (frac <= 0) return { d: '', full: false, tip };
    const large = frac > 0.5 ? 1 : 0;
    const d = doughnut
      ? `M ${at(rad, a0)} A ${q(rad)} ${q(rad)} 0 ${large} 1 ${at(rad, a1)} L ${at(hole, a1)} A ${q(hole)} ${q(hole)} 0 ${large} 0 ${at(hole, a0)} Z`
      : `M ${q(cx)} ${q(cy)} L ${at(rad, a0)} A ${q(rad)} ${q(rad)} 0 ${large} 1 ${at(rad, a1)} Z`;
    return { d, full: false, tip };
  });
  return { cx, cy, rad, hole, wedges };
}

export type BarRect = { x: number; y: number; w: number; h: number; rx: number; tip: ChartPoint };

export type BarMarks = {
  // The zero line the bars grow from: up the plot when a value is below zero, else at its foot (or left edge).
  baseline: { x1: number; y1: number; x2: number; y2: number };
  bars: BarRect[];
  // Where the bars grow from (the animation's origin), on the baseline.
  origin: ChartPoint;
  // The plot's far edge below zero: a column chart's foot (its names go under it), a bar chart's left edge. The
  // baseline's own place when no value is below zero.
  floor: number;
  // Show Axis (pie-chart.md): each tick at its place along the value axis (a y on a column chart, an x on a bar
  // chart), its gridline running across the plot from `span` to its end. Empty without.
  axis: { ticks: { at: number; text: string }[]; span: [number, number] };
};

// Upright columns from a zero baseline, or (horizontal) bars to the right of one; a value below zero hangs below it
// (runs left of it), as standard charts draw them (docs/specs/009-elements/pie-chart.md "Below zero on a column or
// bar chart"). Evenly spaced with a gap, each at most 48 px thick so a two-bar chart is not two slabs.
export function barMarks(
  area: ChartRect,
  data: readonly PieSlice[],
  horizontal: boolean,
  ox = 0,
  oy = 0,
  // Show Axis: tick labels and gridlines, the plot drawn in from the side they take.
  showAxis = false,
): BarMarks {
  // The range always holds zero; one pass, as a chart may hold many data.
  let lo = 0;
  let hi = 0;
  for (const d of data) {
    if (d.value < lo) lo = d.value;
    if (d.value > hi) hi = d.value;
  }
  if (hi === lo) hi = lo + 1;
  // With Show Axis the bars run to round ticks at both ends.
  const scale = showAxis ? axisScale(lo, hi) : null;
  const minVal = scale ? scale.min : lo;
  const maxVal = scale ? scale.max : hi;
  const span = maxVal - minVal;
  // A value's place along the value axis, as a share of the plot from its low end.
  const at = (v: number) => (v - minVal) / span;
  const n = Math.max(1, data.length);
  if (horizontal) {
    // The bottom keeps a row for the tick labels.
    const padY = Math.min(20, area.h * 0.08);
    const tickRow = scale ? AXIS_TICK_FONT_PX + AXIS_TICK_GAP : 0;
    const leftX = ox + area.x + area.w * 0.06;
    const fullW = Math.max(1, ox + area.x + area.w * 0.94 - leftX);
    const xOf = (v: number) => leftX + at(v) * fullW;
    const zeroX = xOf(0);
    const innerH = Math.max(1, area.h - padY * 2 - tickRow);
    const slot = innerH / n;
    const thick = Math.min(slot * 0.7, 48);
    const y0 = oy + area.y + padY;
    return {
      baseline: { x1: zeroX, y1: y0, x2: zeroX, y2: y0 + innerH },
      bars: data.map((d, i) => {
        const end = xOf(d.value);
        const cy = y0 + slot * (i + 0.5);
        return {
          x: Math.min(zeroX, end),
          y: cy - thick / 2,
          w: Math.abs(end - zeroX),
          h: thick,
          rx: Math.min(3, thick / 4),
          tip: { x: end, y: cy },
        };
      }),
      origin: { x: zeroX, y: y0 + innerH / 2 },
      floor: leftX,
      axis: {
        ticks: scale?.ticks.map((t) => ({ at: xOf(t.value), text: t.text })) ?? [],
        span: [y0, y0 + innerH],
      },
    };
  }
  const padX = Math.min(20, area.w * 0.08);
  // The left keeps a column for the tick labels.
  const tickCol = scale ? axisLabelRoom(scale) : 0;
  const topPad = oy + area.y + area.h * 0.1;
  const footY = oy + area.y + area.h * 0.88;
  const innerW = Math.max(1, area.w - padX * 2 - tickCol);
  const slot = innerW / n;
  const thick = Math.min(slot * 0.7, 48);
  const fullH = Math.max(1, footY - topPad);
  const yOf = (v: number) => footY - at(v) * fullH;
  const zeroY = yOf(0);
  const x0 = ox + area.x + padX + tickCol;
  return {
    baseline: { x1: x0, y1: zeroY, x2: x0 + innerW, y2: zeroY },
    bars: data.map((d, i) => {
      const end = yOf(d.value);
      const cx = x0 + slot * (i + 0.5);
      return {
        x: cx - thick / 2,
        y: Math.min(zeroY, end),
        w: thick,
        h: Math.abs(zeroY - end),
        rx: Math.min(3, thick / 4),
        tip: { x: cx, y: end },
      };
    }),
    origin: { x: ox + area.x + area.w / 2, y: zeroY },
    floor: footY,
    axis: {
      ticks: scale?.ticks.map((t) => ({ at: yOf(t.value), text: t.text })) ?? [],
      span: [x0, x0 + innerW],
    },
  };
}

type LineVariant = 'line' | 'area' | 'scatter';

export type LineMarks = {
  plot: { x: number; y: number; w: number; h: number };
  // Per series, a point per category.
  points: ChartPoint[][];
  // Per series, its line as an SVG `points` list (empty for scatter), and its filled area's outline (area only).
  lines: string[];
  areas: string[];
  // The x-axis labels.
  labels: { x: number; text: string }[];
  // The point marker's radius.
  dot: number;
  // The value axes with Show Axis (pie-chart.md): the left one's ticks at their y (its gridlines too), and the right
  // one's when a series is on it. Empty without.
  axis: { left: AxisTick[]; right: AxisTick[] };
};

export type AxisTick = { y: number; text: string };

// A category read as a number for a scatter chart's x ("1,200" is 1200), or null.
export function scatterX(category: string): number | null {
  const t = category.trim().replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// A scatter axis tick, short and the same in every locale (exports must not depend on who drew them).
function tickText(v: number): string {
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e6 || abs < 1e-3) return v.toExponential(1);
  return String(Number(v.toPrecision(3)));
}

// Scatter's x-axis carries this many labels, evenly spaced from the least x to the greatest.
const SCATTER_TICKS = 5;

// Line, area and scatter share an x-axis of categories and a y-axis that always includes zero.
export function lineMarks(
  area: ChartRect,
  categories: readonly string[],
  series: readonly LineSeries[],
  variant: LineVariant,
  ox = 0,
  oy = 0,
  // Show Axis: tick labels and gridlines, the plot drawn in from the sides they take.
  showAxis = false,
): LineMarks {
  const n = categories.length;
  // A series on the second axis, when another is on the first (chart-axis.ts).
  const onRight = rightAxisSeries(series);
  // Zero is always in range so the baseline reads naturally; an all-equal range widens so the line is not flat
  // against the top edge. With Show Axis the range runs to round ticks.
  const range = (right: boolean): { min: number; max: number; scale: AxisScale | null } => {
    let minV = 0;
    let maxV = 0;
    series.forEach((s, i) => {
      if (onRight[i] !== right) return;
      for (const v of s.values) {
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
    });
    if (maxV === minV) maxV = minV + 1;
    if (!showAxis) return { min: minV, max: maxV, scale: null };
    const scale = axisScale(minV, maxV);
    return { min: scale.min, max: scale.max, scale };
  };
  const left = range(false);
  const right = onRight.some(Boolean) ? range(true) : null;
  const padL = left.scale ? axisLabelRoom(left.scale) : 10;
  const padR = right?.scale ? axisLabelRoom(right.scale) : 8;
  const padTop = 12;
  const padBottom = 22;
  const plotX0 = ox + area.x + padL;
  const plotW = Math.max(1, area.w - padL - padR);
  const plotY0 = oy + area.y + padTop;
  const plotH = Math.max(1, area.h - padTop - padBottom);
  const yOn = (r: { min: number; max: number }) => (v: number) =>
    plotY0 + plotH - ((v - r.min) / (r.max - r.min)) * plotH;
  const yAt = yOn(left);
  const yRight = right ? yOn(right) : yAt;
  const evenX = (i: number) => (n <= 1 ? plotX0 + plotW / 2 : plotX0 + (i / (n - 1)) * plotW);

  // Scatter places each point at its category's number when every category is one.
  let xAt = evenX;
  let labels: { x: number; text: string }[];
  const xs = variant === 'scatter' ? categories.map(scatterX) : [];
  if (variant === 'scatter' && n > 0 && xs.every((x) => x !== null)) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const x of xs) {
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
    if (hi === lo) hi = lo + 1;
    const span = hi - lo;
    const scale = (x: number) => plotX0 + ((x - lo) / span) * plotW;
    xAt = (i: number) => scale(xs[i] as number);
    labels = Array.from({ length: SCATTER_TICKS }, (_, k) => {
      const v = lo + (span * k) / (SCATTER_TICKS - 1);
      return { x: scale(v), text: tickText(v) };
    });
  } else {
    labels = categories.map((c, i) => ({ x: evenX(i), text: chartAxisLabel(c, plotW, n) }));
  }

  const points = series.map((s, si) =>
    categories.map((_, i) => ({ x: xAt(i), y: (onRight[si] ? yRight : yAt)(s.values[i] ?? 0) })),
  );
  const lines = points.map((pts) =>
    variant === 'scatter' ? '' : pts.map((p) => `${q(p.x)},${q(p.y)}`).join(' '),
  );
  const areas =
    variant === 'area'
      ? points.map((pts, si) => {
          // Down to its own axis's zero.
          const zeroY = (onRight[si] ? yRight : yAt)(0);
          return pts.length === 0
            ? ''
            : `M ${q(pts[0]!.x)} ${q(zeroY)} ${pts.map((p) => `L ${q(p.x)} ${q(p.y)}`).join(' ')} L ${q(pts[pts.length - 1]!.x)} ${q(zeroY)} Z`;
        })
      : [];
  return {
    plot: { x: plotX0, y: plotY0, w: plotW, h: plotH },
    points,
    lines,
    areas,
    labels,
    dot: variant === 'scatter' ? 4 : 3,
    axis: {
      left: left.scale?.ticks.map((t) => ({ y: yAt(t.value), text: t.text })) ?? [],
      right: right?.scale?.ticks.map((t) => ({ y: yRight(t.value), text: t.text })) ?? [],
    },
  };
}

// The fill opacity of an area chart's areas: overlapping, so each series stays readable through the others.
export const AREA_FILL_OPACITY = 0.25;
