// A chart's value axis (docs/specs/009-elements/pie-chart.md "Show Axis", "A second axis"): round tick values over a
// range that always holds zero, widened to the next round value past the data, so a reader can read a mark against
// the gridlines. Pure and shared, as the marks are (chart-marks.ts): the canvas views and the exporter lay the same
// axis out.

import { shortNumber } from './chart-values';
import type { LineSeries } from './data-shapes';

// How many ticks an axis aims for; it lands on four to six once the step is rounded.
const AXIS_TARGET_TICKS = 5;
// The tick labels' size, in px, the x-axis labels' own, and the room between a label and the plot.
export const AXIS_TICK_FONT_PX = 9;
export const AXIS_TICK_GAP = 6;
// A tick label's width per character at AXIS_TICK_FONT_PX: generous, so the plot never runs under a label.
const AXIS_CHAR_PX = 5.6;

export type AxisScale = { min: number; max: number; ticks: { value: number; text: string }[] };

// The round step (1, 2 or 5 times a power of ten) nearest a raw step, never under it.
function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

// The axis over `lo`..`hi`: zero always in range, both ends widened to a round step, a tick at each step.
export function axisScale(lo: number, hi: number): AxisScale {
  let min = Math.min(0, lo);
  let max = Math.max(0, hi);
  if (max === min) max = min + 1;
  const step = niceStep((max - min) / (AXIS_TARGET_TICKS - 1));
  min = Math.floor(min / step + 1e-9) * step;
  max = Math.ceil(max / step - 1e-9) * step;
  const ticks: AxisScale['ticks'] = [];
  for (let v = min; v <= max + step / 2; v += step) {
    // Rounded to the step's own precision, so 0.1 + 0.2 reads 0.3.
    const value = Number(v.toPrecision(12));
    ticks.push({ value, text: shortNumber(value) });
  }
  return { min, max, ticks };
}

// The width the widest of an axis's labels takes beside the plot, its gap included.
export function axisLabelRoom(scale: AxisScale): number {
  const widest = Math.max(0, ...scale.ticks.map((t) => t.text.length));
  return Math.ceil(widest * AXIS_CHAR_PX) + AXIS_TICK_GAP;
}

// Whether a series is drawn against the second, right-hand axis: only when another is on the left, else the
// right-hand series simply share the one scale.
export function rightAxisSeries(series: readonly LineSeries[]): boolean[] {
  const right = series.map((s) => s.axis === 'right');
  return right.some((r) => !r) ? right : right.map(() => false);
}
