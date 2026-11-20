'use client';

import { useTelemetryApp, type ViewProps } from './app';
import { TimingCard } from './TimingCard';
import { VitalsCard } from './VitalsCard';
import { windowLabel } from './windows';

// The Timings and Web Vitals tabs (docs/specs/017-telemetry/timing-telemetry.md): how fast the experience is. The
// editor's own timings as distributions on one, every site's Core Web Vitals rated against Google's thresholds on
// the other. Every number is an estimate from the buckets the browser sent, never a raw timing.

// The charts are the app's (its config's `timings`): its editor's timings and its frontends' vitals.

const GRID = 'mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3';
const ESTIMATE =
  'Each browser sends only the bucket a timing fell in, so every percentile here is an estimate within its bucket, and one past the last bucket reads as “over” it.';

export function TimingsView({ summary, active }: ViewProps) {
  const { timings } = useTelemetryApp();
  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        How long the key moments in the editor took in{' '}
        <span className="font-medium">{windowLabel(active)}</span>. {ESTIMATE}
      </p>
      <div className={GRID}>
        {timings.editor.map((chart) => (
          <TimingCard key={chart.timing} chart={chart} summary={summary} active={active} />
        ))}
      </div>
    </div>
  );
}

// The Web Vitals tab: each of the app's sites, rated on its full page loads.
export function VitalsView({ summary, active }: ViewProps) {
  const { timings } = useTelemetryApp();
  const apps = [...new Set(timings.vitals.map((c) => c.app!))];
  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The 75th percentile of each full page load in{' '}
        <span className="font-medium">{windowLabel(active)}</span>, rated Good, Needs Work or Poor
        against Google&rsquo;s thresholds. {ESTIMATE}
      </p>
      <div className={GRID}>
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
