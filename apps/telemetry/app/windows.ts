// Everything about the three fixed dashboard windows (Today / Last 7 /
// Last month, spec/22): their labels, their span in days, how a window
// maps onto a slice of the 30-day trend line, and a per-metric count
// lookup. Shared so the global timeframe panel, the Highlights grid, and
// the Search view all agree instead of each hard-coding the windows.

import {
  metricKey,
  type TelemetryDaily,
  type TelemetryWindow,
  type TelemetryWindowKey,
} from '@livediagram/api-schema';

export const WINDOW_META: { key: TelemetryWindowKey; label: string; days: number }[] = [
  { key: 'today', label: 'Today', days: 1 },
  { key: 'last7', label: 'Last 7 days', days: 7 },
  { key: 'last30', label: 'Last month', days: 30 },
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
// single metric's Today / Last 7 / Last month totals without rescanning
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
