// The flow charts' geometry and words (docs/specs/026-plan/plan-views.md "Flow charts", blueprint plan-views.md "Flow
// charts"): the plot box, whole-number y ticks, the day labels along the foot, the Cumulative Flow bands stacked in
// phase order with their colours, and each chart's summary line. Pure: the views draw what this answers.
import { mixHex } from '@liveplanner/project';
import {
  DAY_MS,
  FLOW_NO_STATUS,
  MONTH_SHORT,
  dayParts,
  type FlowCounts,
  type StatusPhase,
  type Throughput,
} from '@liveplanner/items';
import { PHASE_COLOURS } from '@liveplanner/plan-art';

// The plot's margins inside the chart body: the y labels at the left, the day labels at the foot.
// The top leaves room for a count over a bar that reaches the top tick, and the percentile labels.
export const FLOW_PLOT_PAD = { left: 30, right: 14, top: 18, bottom: 22 } as const;
// A body smaller than this shows the summary line alone (no room for a readable plot).
export const FLOW_PLOT_MIN = { width: 200, height: 140 } as const;
// The summary line and the key's heights, above the plot.
export const FLOW_SUMMARY_PX = 30;
// A wrapped key's line, and the most lines it takes before the rest is left to the hover card.
export const FLOW_KEY_LINE_PX = 16;
export const FLOW_KEY_LINES_MAX = 3;
// A key entry's width at 11 px: the swatch and its gap, about 6 px a letter, and the gap to the next.
const KEY_SWATCH_PX = 16;
const KEY_LETTER_PX = 6;
const KEY_GAP_PX = 12;
// Half a day label's width ("30 Nov" at 10 px), so a label is never pushed past the plot's ends.
export const FLOW_DAY_LABEL_HALF_PX = 16;
// The least room a day label takes along the foot ("30 Nov" at 10 px, and a gap).
export const FLOW_DAY_LABEL_PX = 44;
// A Throughput bar narrower than this carries no count on it.
export const FLOW_BAR_LABEL_MIN_PX = 16;

export type PlotBox = { x: number; y: number; width: number; height: number };

// The plot inside a body of `width` × `height` (px) once the rows above it take `above`, in the coordinates of what
// is left under them; null when the body is too small for a readable plot (the summary line then shows alone).
export function flowPlotBox(width: number, height: number, above: number): PlotBox | null {
  if (width < FLOW_PLOT_MIN.width || height < FLOW_PLOT_MIN.height) return null;
  return {
    x: FLOW_PLOT_PAD.left,
    y: FLOW_PLOT_PAD.top,
    width: width - FLOW_PLOT_PAD.left - FLOW_PLOT_PAD.right,
    height: height - above - FLOW_PLOT_PAD.top - FLOW_PLOT_PAD.bottom,
  };
}

// Whole-number ticks from 0 to a round top at or above `max` (1, 2 or 5 times a power of ten apart), about `count`
// of them. The top is never below 1, so an empty chart still has an axis.
export function niceTicks(max: number, count = 4): { top: number; ticks: number[] } {
  const want = Math.max(1, max);
  const raw = want / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? power * 10);
  const top = Math.ceil(want / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
}

// A flow day as the charts name it: "3 Nov" (days are UTC days, as the counts are kept).
export function flowDayLabel(day: number): string {
  const { date, month } = dayParts(day);
  return `${date} ${MONTH_SHORT[month]}`;
}

// The days to label along a foot `widthPx` wide from `fromDay` to `toDay`: evenly spaced, at least
// FLOW_DAY_LABEL_PX apart, always the last day (today).
export function flowDayTicks(fromDay: number, toDay: number, widthPx: number): number[] {
  const days = toDay - fromDay + 1;
  const fit = Math.max(1, Math.floor(widthPx / FLOW_DAY_LABEL_PX));
  const step = Math.max(1, Math.ceil(days / fit));
  const out: number[] = [];
  for (let day = toDay; day >= fromDay; day -= step) out.unshift(day);
  return out;
}

// The foot's labels as drawn: each kept whole inside the plot (clamped, centred), and, walking back from the last
// (today), any that would sit closer than FLOW_DAY_LABEL_PX to the one after it dropped, so none collide.
export function placeFootLabels<T extends { x: number }>(
  labels: readonly T[],
  left: number,
  right: number,
): T[] {
  const lo = left + FLOW_DAY_LABEL_HALF_PX;
  const hi = right - FLOW_DAY_LABEL_HALF_PX;
  const out: T[] = [];
  let next = Infinity;
  for (let i = labels.length - 1; i >= 0; i--) {
    const x = Math.min(hi, Math.max(lo, labels[i]!.x));
    if (next - x < FLOW_DAY_LABEL_PX) continue;
    out.unshift({ ...labels[i]!, x });
    next = x;
  }
  return out;
}

// How many lines a key of `labels` wraps to across `width` px (at least 1, at most FLOW_KEY_LINES_MAX).
export function flowKeyLines(labels: readonly string[], width: number): number {
  let lines = 1;
  let used = 0;
  for (const label of labels) {
    const w = KEY_SWATCH_PX + label.length * KEY_LETTER_PX;
    if (used > 0 && used + KEY_GAP_PX + w > width) {
      lines++;
      used = w;
    } else used += (used > 0 ? KEY_GAP_PX : 0) + w;
  }
  return Math.min(FLOW_KEY_LINES_MAX, lines);
}

// The x of a moment (ms) on a range's plot, 0 at the start of `fromDay` and 1 at the end of `toDay`.
export function flowX(ms: number, fromDay: number, toDay: number): number {
  return (ms / DAY_MS - fromDay) / (toDay - fromDay + 1);
}

export type FlowBand = {
  status: string;
  label: string;
  phase: StatusPhase;
  colour: string;
  // The band's own count each day, and its top as stacked (the sum of it and every band under it).
  values: number[];
  tops: number[];
};

export type CumulativeFlowModel = {
  // Bottom to top: Done first, the first column last.
  bands: FlowBand[];
  // Each day's total, and the most of any day.
  totals: number[];
  max: number;
  // The first day drawn (days before it had no counts), or null with none.
  countedFrom: number | null;
  // The last day's cards in an In Progress status, and in a Done one.
  inProgress: number;
  done: number;
};

const PHASE_RANK: Record<StatusPhase, number> = { done: 0, doing: 1, todo: 2 };

// The bands of a range's counts: one per status, Done at the bottom and the first column on top (the boards' order
// read backwards inside each phase), a card with no status at the very top, each in its phase's colour family: the
// phase's colour, the next status of the phase mixed further toward the surface.
export function cumulativeFlowModel(
  counts: FlowCounts,
  phases: ReadonlyMap<string, StatusPhase>,
  statusNames: ReadonlyMap<string, string>,
  surface: string,
): CumulativeFlowModel {
  const order = [...statusNames.keys()];
  const indexOf = (status: string) => {
    if (status === FLOW_NO_STATUS) return -1;
    const at = order.indexOf(status);
    return at < 0 ? order.length : at;
  };
  const statuses = [...counts.byStatus.keys()].map((status) => ({
    status,
    phase: (status !== FLOW_NO_STATUS && phases.get(status)) || 'todo',
    index: indexOf(status),
  }));
  statuses.sort(
    (a, b) =>
      PHASE_RANK[a.phase] - PHASE_RANK[b.phase] ||
      b.index - a.index ||
      (a.status < b.status ? -1 : 1),
  );
  const perPhase = new Map<StatusPhase, number>();
  for (const s of statuses) perPhase.set(s.phase, (perPhase.get(s.phase) ?? 0) + 1);
  const seen = new Map<StatusPhase, number>();
  const running = new Array<number>(counts.days).fill(0);
  const bands: FlowBand[] = statuses.map(({ status, phase }) => {
    const n = perPhase.get(phase)!;
    // Inside a phase, the status nearest the boundary below keeps the full colour, the next lighter.
    const i = seen.get(phase) ?? 0;
    seen.set(phase, i + 1);
    const values = counts.byStatus.get(status)!;
    const tops = values.map((v, d) => (running[d] = (running[d] ?? 0) + v));
    return {
      status,
      label: status === FLOW_NO_STATUS ? 'No status' : (statusNames.get(status) ?? titleOf(status)),
      phase,
      colour: bandColour(phase, n > 1 ? i / (n - 1) : 0, surface),
      values,
      tops,
    };
  });
  const last = counts.days - 1;
  let inProgress = 0;
  let done = 0;
  for (const b of bands) {
    const v = last >= 0 ? (b.values[last] ?? 0) : 0;
    if (b.phase === 'doing') inProgress += v;
    if (b.phase === 'done') done += v;
  }
  return {
    bands,
    totals: running,
    max: Math.max(0, ...running),
    countedFrom: counts.countedFrom,
    inProgress,
    done,
  };
}

// A dark surface's ramps per phase, from the status nearest the band under it to the furthest: work in progress the
// brightest blues, Done greens a step quieter, Not Started a muted slate that still clears 3:1 on the surface
// (WCAG 1.4.11), so the eye goes to what is moving and every band and swatch is visible.
const DARK_RAMPS: Record<StatusPhase, readonly [string, string]> = {
  doing: ['#60a5fa', '#93c5fd'],
  done: ['#22c55e', '#15803d'],
  todo: ['#64748b', '#7b8aa0'],
};

// Whether a surface is dark (its relative luminance under a half).
export function isDarkSurface(surface: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(surface);
  if (!m) return false;
  const n = parseInt(m[1]!, 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return l < 0.18;
}

// A band's colour: `t` (0 to 1) of the way along its phase's family. On a light surface the phase colour mixed toward
// the surface (mixHex takes the first colour's share); on a dark one along DARK_RAMPS.
export function bandColour(phase: StatusPhase, t: number, surface: string): string {
  if (isDarkSurface(surface)) {
    const [a, b] = DARK_RAMPS[phase];
    return mixHex(b, a, t);
  }
  return mixHex(PHASE_COLOURS[phase], surface, 1 - t * 0.55);
}

// A status id no board names any more, read as words: "in-review" is "In review".
function titleOf(status: string): string {
  const words = status.replace(/[-_]+/g, ' ').trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : status;
}

// "6 days", "1 day", "0.5 days".
export function daysText(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

// Cycle Time's summary line: "85% in 6 days or less · 50% in 3".
export function cycleTimeSummary(p50: number | null, p85: number | null): string {
  if (p50 === null || p85 === null) return '';
  return `85% in ${daysText(p85)} or less · 50% in ${p50}`;
}

// Throughput's summary line: "8 a week on average", or that no whole period has passed yet.
export function throughputSummary(t: Throughput): string {
  const unit = t.period === 'day' ? 'day' : 'week';
  return t.average === null ? `No whole ${unit} yet` : `${t.average} a ${unit} on average`;
}

// A Throughput period as hovering names it: "Week of 3 Nov" or "3 Nov".
export function periodLabel(start: number, period: Throughput['period']): string {
  return period === 'week' ? `Week of ${flowDayLabel(start)}` : flowDayLabel(start);
}
