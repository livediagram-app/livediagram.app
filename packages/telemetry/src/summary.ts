// The dashboard's data (liveworkspace/docs/telemetry.md "The dashboard"): grouped counts for three
// FIXED windows and a 30-day daily series, for one app or for every app. No custom ranges, so the one
// query stays simple and the response is cacheable.

import type { TelemetryApp, TelemetryAppFilter } from './apps';

export type TelemetryWindowKey = 'today' | 'last7' | 'last30';

// How many UTC calendar days each window spans, ending with today (so `last7` is today plus the six
// days before it, each from UTC midnight). The service counts each window over exactly these days and
// the dashboard highlights the same span of the trend line, so a card's number and its line agree.
export const TELEMETRY_WINDOW_DAYS: Record<TelemetryWindowKey, number> = {
  today: 1,
  last7: 7,
  last30: 30,
};

const DAY_MS = 86_400_000;
const SERIES_DAYS = TELEMETRY_WINDOW_DAYS.last30;

export type TelemetryCount = {
  category: string;
  action: string;
  type: string | null;
  count: number;
};

export type TelemetryWindow = {
  total: number;
  rows: TelemetryCount[];
  // Each app's share of `total`. Every app the summary counts is present, zero when it sent nothing.
  // Optional, like `daily` and `previousWindows` below, so a payload or fixture in the shape the apps'
  // dashboards were written against still parses.
  byApp?: Partial<Record<TelemetryApp, number>>;
};

// `byMetric` is the per-event version of `byCategory`: one 30-day series per distinct event, keyed by
// `metricKey(category, action, type)`. `byApp` is each app's daily total.
export type TelemetryDaily = {
  days: number[];
  totals: number[];
  byCategory: Record<string, number[]>;
  byMetric: Record<string, number[]>;
  byApp?: Partial<Record<TelemetryApp, number[]>>;
};

export type TelemetrySummary = {
  enabled: boolean;
  generatedAt: number;
  // Which app these numbers count, or 'all' for every app summed. Optional for the same reason as
  // `byApp`: the apps' dashboard fixtures predate it.
  app?: TelemetryAppFilter;
  windows: Record<TelemetryWindowKey, TelemetryWindow>;
  // Each window's counts over the same number of days just before it, for the trend arrows.
  previousWindows?: Record<TelemetryWindowKey, TelemetryWindow>;
  // Present whenever `enabled` is true.
  daily?: TelemetryDaily;
};

// The disabled answer: the service is up but storing and serving nothing.
export type TelemetryDisabled = { enabled: false };

// Stable key for a single (category, action, type) event. `type` null collapses to '' so the key is
// always a 3-part `a|b|c` string.
export function metricKey(category: string, action: string, type: string | null): string {
  return `${category}|${action}|${type ?? ''}`;
}

// UTC midnight of the oldest day in the 30-day series: today's midnight minus 29 days.
export function telemetrySeriesStart(now: number): number {
  const d = new Date(now);
  const midnightUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return midnightUtc - (SERIES_DAYS - 1) * DAY_MS;
}

// The query reaches one series further back than the series itself, so each window can be compared
// with the span just before it: the 30 days before the last 30 end 59 days back, inside the 60-day
// retention.
export function telemetryQueryStart(now: number): number {
  return telemetrySeriesStart(now) - SERIES_DAYS * DAY_MS;
}

// One row of the service's per-day grouped query.
export type TelemetryDailyRow = {
  day: string;
  app: TelemetryApp;
  category: string;
  action: string;
  type: string | null;
  count: number;
};

// Build the whole summary from ONE per-day query. Each window is the sum of its last N day buckets,
// so a window covers exactly the calendar days the dashboard highlights. Rows from several apps with
// the same event add up into one row: Document·Created is the same thing whichever app counted it.
export function buildTelemetrySummary(
  now: number,
  app: TelemetryAppFilter,
  apps: readonly TelemetryApp[],
  dailyRows: readonly TelemetryDailyRow[],
): TelemetrySummary {
  const since = telemetrySeriesStart(now);
  const zeros = () => Array.from({ length: SERIES_DAYS }, () => 0);
  const days: number[] = [];
  const totals = zeros();
  const byCategory: Record<string, number[]> = {};
  const byMetric: Record<string, number[]> = {};
  const byApp = Object.fromEntries(apps.map((a) => [a, zeros()])) as Record<TelemetryApp, number[]>;
  const dayIndex = new Map<string, number>();
  for (let i = 0; i < SERIES_DAYS; i++) {
    const ts = since + i * DAY_MS;
    days.push(ts);
    dayIndex.set(new Date(ts).toISOString().slice(0, 10), i);
  }

  type Bucket = { rows: Map<string, TelemetryCount>; byApp: Record<string, number> };
  const keys = Object.keys(TELEMETRY_WINDOW_DAYS) as TelemetryWindowKey[];
  const emptyBuckets = () =>
    Object.fromEntries(
      keys.map((k) => [k, { rows: new Map(), byApp: Object.fromEntries(apps.map((a) => [a, 0])) }]),
    ) as Record<TelemetryWindowKey, Bucket>;
  const windowRows = emptyBuckets();
  const previousRows = emptyBuckets();
  const addTo = (bucket: Bucket, key: string, row: TelemetryDailyRow) => {
    bucket.byApp[row.app] = (bucket.byApp[row.app] ?? 0) + row.count;
    const prev = bucket.rows.get(key);
    if (prev) prev.count += row.count;
    else
      bucket.rows.set(key, {
        category: row.category,
        action: row.action,
        type: row.type,
        count: row.count,
      });
  };
  const bump = (series: Record<string, number[]>, key: string, idx: number, n: number) => {
    const s = series[key] ?? zeros();
    s[idx] = (s[idx] ?? 0) + n;
    series[key] = s;
  };

  for (const row of dailyRows) {
    const key = metricKey(row.category, row.action, row.type);
    // Days from the series start: 0..29 inside the series, negative before it.
    const offset = Math.round((Date.parse(`${row.day}T00:00:00Z`) - since) / DAY_MS);
    if (offset < 0) {
      // Only the span just before each window, for the trend arrows.
      for (const k of keys) {
        const n = TELEMETRY_WINDOW_DAYS[k];
        if (offset >= SERIES_DAYS - 2 * n && offset < SERIES_DAYS - n)
          addTo(previousRows[k], key, row);
      }
      continue;
    }
    const idx = dayIndex.get(row.day);
    if (idx === undefined) continue;
    totals[idx] = (totals[idx] ?? 0) + row.count;
    bump(byCategory, row.category, idx, row.count);
    bump(byMetric, key, idx, row.count);
    bump(byApp, row.app, idx, row.count);
    for (const k of keys) {
      const n = TELEMETRY_WINDOW_DAYS[k];
      if (idx >= SERIES_DAYS - n) addTo(windowRows[k], key, row);
      // The previous span of a short window sits inside the series.
      else if (idx >= SERIES_DAYS - 2 * n) addTo(previousRows[k], key, row);
    }
  }

  const toWindow = (bucket: Bucket): TelemetryWindow => {
    const sorted = [...bucket.rows.values()].sort((a, b) => b.count - a.count);
    return {
      total: sorted.reduce((sum, r) => sum + r.count, 0),
      rows: sorted,
      byApp: bucket.byApp as Record<TelemetryApp, number>,
    };
  };
  const windows = (buckets: Record<TelemetryWindowKey, Bucket>) =>
    Object.fromEntries(keys.map((k) => [k, toWindow(buckets[k])])) as Record<
      TelemetryWindowKey,
      TelemetryWindow
    >;
  return {
    enabled: true,
    generatedAt: now,
    app,
    windows: windows(windowRows),
    previousWindows: windows(previousRows),
    daily: { days, totals, byCategory, byMetric, byApp },
  };
}
