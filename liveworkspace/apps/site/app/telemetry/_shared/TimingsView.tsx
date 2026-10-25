'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@liveworkspace/telemetry';
import { useTelemetryApp } from './app';
import { TimingCard } from './TimingCard';
import { VitalsCard } from './VitalsCard';
import { windowLabel } from './windows';

// Timings section of the Health tab (docs/specs/017-telemetry/timing-telemetry.md): how fast the experience is. The
// editor's own timings as distributions, then every app's Core Web Vitals rated against Google's
// thresholds. Every number is an estimate from the buckets the browser sent, never a raw timing.

// The charts are the app's (its config's `timings`): its editor's timings and its frontends' vitals.

export function TimingsView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const { timings } = useTelemetryApp();
  const apps = [...new Set(timings.vitals.map((c) => c.app!))];
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
        {timings.editor.map((chart) => (
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
        {apps.map((app) => (
          <VitalsCard
            key={app}
            app={app}
            charts={timings.vitals.filter((c) => c.app === app)}
            summary={summary}
            active={active}
          />
        ))}
      </div>
    </div>
  );
}
