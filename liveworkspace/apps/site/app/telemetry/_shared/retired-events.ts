import type { TelemetrySummary, TelemetryWindow } from '@liveworkspace/telemetry';

// Retired features never render (docs/specs/017-telemetry/telemetry.md "Retired features"). Which
// events are retired is each app's own (its retired-events.ts `isRetiredEvent`); taking them out of a
// summary is the same for every app.

export type IsRetired = (category: string, action: string, type: string | null) => boolean;

function dropFromWindow(window: TelemetryWindow, isRetired: IsRetired): TelemetryWindow {
  let dropped = 0;
  const rows = window.rows.filter((r) => {
    if (!isRetired(r.category, r.action, r.type)) return true;
    dropped += r.count;
    return false;
  });
  return dropped === 0 ? window : { total: window.total - dropped, rows };
}

const splitKey = (key: string): [string, string, string | null] => {
  const [category = '', action = '', type = ''] = key.split('|');
  return [category, action, type === '' ? null : type];
};

// The summary without any retired event: window rows and totals, the
// previous windows behind the trend arrows, and the daily series (each
// retired series also comes off its category's line and the day totals).
export function dropRetiredEvents(
  summary: TelemetrySummary,
  isRetired: IsRetired,
): TelemetrySummary {
  // A deployment with telemetry off answers `{ enabled: false }` and nothing else: there is nothing to drop, and
  // reading its absent windows threw, which the dashboard took for a failed request ("Couldn't load the
  // numbers") instead of showing that telemetry is off here.
  if (!summary.enabled || !summary.windows) return summary;
  const windows = Object.fromEntries(
    Object.entries(summary.windows).map(([k, w]) => [k, dropFromWindow(w, isRetired)]),
  ) as TelemetrySummary['windows'];
  const previousWindows = summary.previousWindows
    ? (Object.fromEntries(
        Object.entries(summary.previousWindows).map(([k, w]) => [k, dropFromWindow(w, isRetired)]),
      ) as TelemetrySummary['previousWindows'])
    : undefined;
  let daily = summary.daily;
  if (daily) {
    const retired = Object.keys(daily.byMetric).filter((key) => isRetired(...splitKey(key)));
    if (retired.length > 0) {
      const byMetric = { ...daily.byMetric };
      const byCategory = { ...daily.byCategory };
      const totals = [...daily.totals];
      for (const key of retired) {
        const series = byMetric[key] ?? [];
        delete byMetric[key];
        const [category] = splitKey(key);
        const line = byCategory[category];
        if (line) byCategory[category] = line.map((n, i) => Math.max(0, n - (series[i] ?? 0)));
        series.forEach((n, i) => {
          totals[i] = Math.max(0, (totals[i] ?? 0) - n);
        });
      }
      daily = { ...daily, byMetric, byCategory, totals };
    }
  }
  return {
    ...summary,
    windows,
    ...(previousWindows ? { previousWindows } : {}),
    ...(daily ? { daily } : {}),
  };
}
