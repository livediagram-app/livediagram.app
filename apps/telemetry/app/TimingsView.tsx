'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { EDITOR_TIMING_CHARTS, WEB_VITAL_CHARTS } from './metric-catalogue';
import type { MetricGroup } from './metric-series';
import { TimingCard } from './TimingCard';
import { VitalsCard } from './VitalsCard';
import { windowLabel } from './windows';

// Timings view (docs/specs/017-telemetry/timing-telemetry.md): how fast the experience is. The
// editor's own timings as distributions, then every app's Core Web Vitals rated against Google's
// thresholds. Every number is an estimate from the buckets the browser sent, never a raw timing.

// The charts this tab shows, as the emitter coverage tests read every tab's.
export const GROUPS: MetricGroup[] = [
  { title: 'Editor timings', metrics: [...EDITOR_TIMING_CHARTS] },
  { title: 'Core Web Vitals', metrics: [...WEB_VITAL_CHARTS] },
];

const APPS = [...new Set(WEB_VITAL_CHARTS.map((c) => c.app!))];

export function TimingsView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        How long the key moments took in <span className="font-medium">{windowLabel(active)}</span>.
        Each browser sends only the bucket a timing fell in, so every percentile here is an estimate
        within its bucket, and one past the last bucket reads as &ldquo;over&rdquo; it.
      </p>
      <h2 className="mt-8 text-base font-semibold text-slate-900 dark:text-slate-100">
        Editor Timings
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {EDITOR_TIMING_CHARTS.map((chart) => (
          <TimingCard key={chart.timing} chart={chart} summary={summary} active={active} />
        ))}
      </div>
      <h2 className="mt-10 text-base font-semibold text-slate-900 dark:text-slate-100">
        Core Web Vitals
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        The 75th percentile of each full page load, rated Good, Needs Work or Poor against
        Google&rsquo;s thresholds.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {APPS.map((app) => (
          <VitalsCard
            key={app}
            app={app}
            charts={WEB_VITAL_CHARTS.filter((c) => c.app === app)}
            summary={summary}
            active={active}
          />
        ))}
      </div>
    </div>
  );
}
