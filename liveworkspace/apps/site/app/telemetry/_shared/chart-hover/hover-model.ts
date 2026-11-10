// The dashboard charts' one hover model (liveworkspace/docs/specs/008-telemetry/telemetry.md "Tooltips"), pure so
// every rule is tested without a browser: which bucket a pointer is over, where a key moves it, where the tooltip
// goes, and what it says.

import { dateFormat } from '@liveworkspace/ui/date-format';

// How the buckets sit across the plot: a line chart's points, first at the left edge and last at the right, or a bar
// chart's columns, each an equal band.
export type HoverMode = 'points' | 'bands';

/** One line (or the bars) as the tooltip and the markers read it. */
export type HoverSeries = {
  key: string;
  label: string;
  // One per bucket; null where the bucket has no reading.
  values: readonly (number | null)[];
  // A CSS colour; `var(--color-brand-500)` is the accent of the nearest `data-app` (`app`, when set).
  color: string;
  app?: string;
  // Styles the swatch and marker (a neutral line's `text-slate-500`, for a `currentColor` colour).
  className?: string;
  dashed?: boolean;
  // This line is the chart's Total: the tooltip shows it as the Total row, under the others.
  total?: boolean;
  // Each bucket's marker height, as a percentage from the plot's top; null draws no marker there.
  y?: readonly (number | null)[];
};

/** Each bucket's centre across the plot, 0..1, in order: the x a pointer is snapped against. */
export function bucketCentres(n: number, mode: HoverMode): Float64Array {
  const xs = new Float64Array(Math.max(0, n));
  for (let i = 0; i < n; i++) {
    xs[i] = mode === 'bands' ? (i + 0.5) / n : n > 1 ? i / (n - 1) : 0.5;
  }
  return xs;
}

/** The bucket whose centre is nearest `x` (0..1): a binary search, so O(log n) per pointer move. */
export function nearestIndex(xs: ArrayLike<number>, x: number): number | null {
  const n = xs.length;
  if (n === 0) return null;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((xs[mid] as number) < x) lo = mid + 1;
    else hi = mid;
  }
  // `lo` is the first centre at or right of `x`; the one before it may be nearer.
  if (lo > 0 && x - (xs[lo - 1] as number) <= (xs[lo] as number) - x) return lo - 1;
  return lo;
}

// Page Up and Page Down step a week of days.
const PAGE = 7;

/**
 * Where a key moves the focused bucket, or `undefined` for a key the chart doesn't take. From nothing, Left and Right
 * start at the latest bucket, the one a reader most often wants.
 */
export function stepIndex(key: string, i: number | null, n: number): number | undefined {
  if (n === 0) return undefined;
  const last = n - 1;
  const at = i ?? last;
  switch (key) {
    case 'ArrowLeft':
      return i === null ? last : Math.max(0, at - 1);
    case 'ArrowRight':
      return i === null ? last : Math.min(last, at + 1);
    case 'Home':
      return 0;
    case 'End':
      return last;
    case 'PageUp':
      return Math.max(0, at - PAGE);
    case 'PageDown':
      return Math.min(last, at + PAGE);
    default:
      return undefined;
  }
}

/** The next key in `keys` from `current`, `delta` steps on, wrapping; the first or last from none. */
export function cycleKey(keys: readonly string[], current: string | null, delta: 1 | -1) {
  if (keys.length === 0) return null;
  const at = current === null ? -1 : keys.indexOf(current);
  if (at === -1) return delta === 1 ? keys[0]! : keys[keys.length - 1]!;
  return keys[(at + delta + keys.length) % keys.length]!;
}

export type Box = { left: number; top: number; right: number; bottom: number };
export type TooltipSide = 'right' | 'left' | 'above' | 'below';
export type TooltipPlace = { left: number; top: number; side: TooltipSide };

// Room between the crosshair and the tooltip, and between the tooltip and the viewport's edge.
export const TOOLTIP_GAP_PX = 14;
export const TOOLTIP_MARGIN_PX = 8;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

/**
 * Where the tooltip goes, in viewport pixels: beside the crosshair at `x`, right of it, flipped left when it would
 * leave the viewport, so it never covers the bucket's points; above the plot (below it, when the plot is at the top
 * of the screen) when neither side has room.
 */
export function placeTooltip({
  plot,
  x,
  size,
  viewport,
  gap = TOOLTIP_GAP_PX,
  margin = TOOLTIP_MARGIN_PX,
}: {
  plot: Box;
  x: number;
  size: { width: number; height: number };
  viewport: { width: number; height: number };
  gap?: number;
  margin?: number;
}): TooltipPlace {
  const { width, height } = size;
  const sideTop = clamp(plot.top, margin, viewport.height - margin - height);
  if (x + gap + width <= viewport.width - margin)
    return { left: x + gap, top: sideTop, side: 'right' };
  if (x - gap - width >= margin) return { left: x - gap - width, top: sideTop, side: 'left' };
  const left = clamp(x - width / 2, margin, viewport.width - margin - width);
  const above = plot.top - gap - height;
  if (above >= margin) return { left, top: above, side: 'above' };
  return {
    left,
    top: clamp(plot.bottom + gap, margin, viewport.height - margin - height),
    side: 'below',
  };
}

export type Change = { dir: 'up' | 'down'; pct: string } | { dir: 'flat' } | { dir: 'new' };

/** A count against the bucket before it; null when either has no reading. */
export function changeOf(now: number | null, before: number | null): Change | null {
  if (now === null || before === null) return null;
  if (now === before) return { dir: 'flat' };
  if (before === 0) return { dir: 'new' };
  const pct = Math.round((Math.abs(now - before) / before) * 100);
  return { dir: now > before ? 'up' : 'down', pct: pct === 0 ? '<1%' : `${COUNT.format(pct)}%` };
}

/** The change as the tooltip writes it: "+12%", "−5%" (a minus sign), "New", "Flat". */
export function changeText(change: Change): string {
  if (change.dir === 'up') return `+${change.pct}`;
  if (change.dir === 'down') return `−${change.pct}`;
  return change.dir === 'new' ? 'New' : 'Flat';
}

/** The change as a screen reader hears it. */
function changeSpoken(change: Change): string {
  if (change.dir === 'up' || change.dir === 'down') return `${change.dir} ${change.pct}`;
  return change.dir === 'new' ? 'new' : 'flat';
}

// Counts with thousands separators, one formatter for every tooltip.
const COUNT = new Intl.NumberFormat('en-GB');
export const formatCount = (v: number): string => COUNT.format(v);

// "Tue 10 Nov" in the UK, "Tue, Nov 10" in the US: UTC, as the api buckets the days.
const DAY_HEADING = dateFormat({
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
export const dayHeading = (ms: number, locale?: string): string => DAY_HEADING.format(ms, locale);

export const NO_READING = 'No Reading';

export type TooltipRow = {
  key: string;
  label: string;
  value: number | null;
  text: string;
  change: Change | null;
  series: HoverSeries;
};

/**
 * The tooltip's rows for bucket `i`: one per line, largest first (no reading last, ties in the lines' order), each
 * with its change against the bucket before when `change` is on, and the Total: the Total line's, or the lines
 * added up under `totalLabel`, or none.
 */
export function tooltipRows(
  series: readonly HoverSeries[],
  i: number,
  {
    format = formatCount,
    change = true,
    totalLabel,
  }: { format?: (v: number) => string; change?: boolean; totalLabel?: string } = {},
): { rows: TooltipRow[]; total: TooltipRow | null } {
  const rowOf = (s: HoverSeries): TooltipRow => {
    const value = s.values[i] ?? null;
    return {
      key: s.key,
      label: s.label,
      value,
      text: value === null ? NO_READING : format(value),
      change: change && i > 0 ? changeOf(value, s.values[i - 1] ?? null) : null,
      series: s,
    };
  };
  const rows = series
    .filter((s) => !s.total)
    .map(rowOf)
    .map((row, order) => ({ row, order }))
    .sort((a, b) => (b.row.value ?? -Infinity) - (a.row.value ?? -Infinity) || a.order - b.order)
    .map(({ row }) => row);
  const line = series.find((s) => s.total);
  if (line) return { rows, total: rowOf(line) };
  if (!totalLabel) return { rows, total: null };
  const add = (at: number) => series.reduce((sum, s) => sum + (s.values[at] ?? 0), 0);
  const value = add(i);
  return {
    rows,
    total: {
      key: 'total',
      label: totalLabel,
      value,
      text: format(value),
      change: change && i > 0 ? changeOf(value, add(i - 1)) : null,
      series: { key: 'total', label: totalLabel, values: [], color: 'currentColor' },
    },
  };
}

/** What the live region reads for a bucket: its heading, each row with its change, then the Total. */
export function liveSummary(
  heading: string,
  rows: readonly TooltipRow[],
  total: TooltipRow | null,
): string {
  const say = (r: TooltipRow) =>
    `${r.label} ${r.text}${r.change ? `, ${changeSpoken(r.change)}` : ''}.`;
  return [`${heading}.`, ...rows.map(say), ...(total ? [say(total)] : [])].join(' ');
}
