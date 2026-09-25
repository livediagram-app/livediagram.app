// Everything about the three fixed dashboard windows (Today / Last 7 days /
// Last 30 days, spec/22): their labels, their span in days, how a window
// maps onto a slice of the 30-day trend line, and a per-metric count
// lookup. Shared so the global timeframe panel, the Dashboard grid, and
// the Search view all agree instead of each hard-coding the windows.

import {
  metricKey,
  TELEMETRY_WINDOW_DAYS,
  type TelemetryDaily,
  type TelemetryWindow,
  type TelemetryWindowKey,
} from '@livediagram/api-schema';

// Whole UTC calendar days ending today (TELEMETRY_WINDOW_DAYS, shared with
// the api, which counts each window over exactly these days). `hint` says so
// on the card: "Last 7 days" read as a rolling 168 hours otherwise, and the
// count only matched the highlighted span of the trend line once both were
// the same calendar days.
export const WINDOW_META: { key: TelemetryWindowKey; label: string; hint: string; days: number }[] =
  [
    { key: 'today', label: 'Today', hint: 'Since midnight UTC', days: TELEMETRY_WINDOW_DAYS.today },
    {
      key: 'last7',
      label: 'Last 7 days',
      hint: 'Today and the 6 days before, UTC',
      days: TELEMETRY_WINDOW_DAYS.last7,
    },
    {
      key: 'last30',
      label: 'Last 30 days',
      hint: 'Today and the 29 days before, UTC',
      days: TELEMETRY_WINDOW_DAYS.last30,
    },
  ];

export function windowLabel(key: TelemetryWindowKey): string {
  return WINDOW_META.find((w) => w.key === key)?.label ?? key;
}

// Index into `daily.days` where the selected window begins, so a trend
// line can draw the matching span as the highlighted (accent) portion.
// today -> just the final day; last30 -> the whole line.
export function windowHighlightFrom(daily: TelemetryDaily, active: TelemetryWindowKey): number {
  const span = WINDOW_META.find((w) => w.key === active)?.days ?? 30;
  return Math.max(0, daily.days.length - span);
}

// Per-window count lookup keyed by metricKey, so any view can read a
// single metric's Today / Last 7 days / Last 30 days totals without rescanning
// the window rows each render.
export function buildWindowCounts(
  windows: Record<TelemetryWindowKey, TelemetryWindow>,
): Record<TelemetryWindowKey, Map<string, number>> {
  const out = {} as Record<TelemetryWindowKey, Map<string, number>>;
  for (const { key } of WINDOW_META) {
    const map = new Map<string, number>();
    for (const row of windows[key].rows) {
      map.set(metricKey(row.category, row.action, row.type), row.count);
    }
    out[key] = map;
  }
  return out;
}

/** How many whole UTC days the window spans. */
export function windowDays(active: TelemetryWindowKey): number {
  return WINDOW_META.find((w) => w.key === active)?.days ?? 30;
}

/**
 * What a trend arrow compares against: the same number of days just before
 * the window, named for its tooltip. Null when the 30-day series can't reach
 * that far back (behind the 30-day window), so no arrow is drawn.
 */
export function previousSpanLabel(
  daily: TelemetryDaily | undefined,
  active: TelemetryWindowKey,
): string | null {
  const days = windowDays(active);
  if (!daily || days * 2 > daily.days.length) return null;
  return days === 1 ? 'the day before' : `the ${days} days before`;
}
