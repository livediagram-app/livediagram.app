'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { EmptyState } from '@livediagram/ui';
import type { TelemetryDaily, TelemetryWindow, TelemetryWindowKey } from '@livediagram/api-schema';
import { eventExplanation } from './event-explanation';
import { categoryColor } from './event-vocab';
import { ActivityGlyph } from './glyphs';
import { buildMetrics, type Metric } from './metrics';
import { MetricBreadcrumb, metricCrumbs, type CloudPath } from './MetricBreadcrumb';
import { MetricCloud } from './MetricCloud';
import { MetricPicker } from './MetricPicker';
import { EventIcon } from './telemetry-event-icon';
import { TrendChart } from './TrendChart';
import { buildWindowCounts, WINDOW_META, windowHighlightFrom } from './windows';

// The Search view (docs/specs/017-telemetry/telemetry.md): find one specific event, by typing a query in
// the MetricPicker or by clicking through the word cloud below it (category,
// then action, then type), then see just that metric charted over time. The metric universe is exactly the
// keys of `daily.byMetric`, so anything offered has a line to draw.

// The beat between each piece of a charted metric easing in.
const RISE_STEP_MS = 60;

export function MetricSearch({
  windows,
  daily,
  active,
}: {
  windows: Record<TelemetryWindowKey, TelemetryWindow>;
  daily: TelemetryDaily;
  active: TelemetryWindowKey;
}) {
  const [selected, setSelected] = useState<Metric | null>(null);
  // The cloud's level, kept here so the breadcrumb over a charted metric
  // (docs/specs/017-telemetry/telemetry.md) can step back to any level of the cloud.
  const [path, setPath] = useState<CloudPath>([]);
  const navigate = (to: CloudPath) => {
    setSelected(null);
    setPath(to);
  };

  const metrics = useMemo(() => buildMetrics(daily), [daily]);
  const windowCounts = useMemo(() => buildWindowCounts(windows), [windows]);

  // Nothing to search: an older api with no byMetric, or a brand-new
  // deployment with zero events. Show the illustrated empty state rather
  // than a dead search box.
  if (metrics.length === 0) {
    return (
      <EmptyState
        icon={<ActivityGlyph />}
        title="No metrics to search yet"
        description="Once events start arriving you’ll be able to find any single metric here and chart it over time."
      />
    );
  }

  return (
    <div>
      <MetricPicker metrics={metrics} onSelect={setSelected} />

      {selected ? (
        <SelectedMetric
          metric={selected}
          breadcrumb={
            <MetricBreadcrumb crumbs={metricCrumbs(path, selected)} onNavigate={navigate} />
          }
          windowCounts={windowCounts}
          daily={daily}
          active={active}
        />
      ) : (
        <MetricCloud
          metrics={metrics}
          counts={windowCounts[active]}
          path={path}
          onPathChange={setPath}
          onSelect={setSelected}
        />
      )}
    </div>
  );
}

function SelectedMetric({
  metric,
  breadcrumb,
  windowCounts,
  daily,
  active,
}: {
  metric: Metric;
  // Sits where the cloud card has it (same card shape, same inset), so it
  // holds still as you step between the cloud and a charted metric.
  breadcrumb: ReactNode;
  windowCounts: Record<TelemetryWindowKey, Map<string, number>>;
  daily: TelemetryDaily;
  active: TelemetryWindowKey;
}) {
  const color = categoryColor(metric.category);
  const series = daily.byMetric[metric.key] ?? [];
  // Everything below the breadcrumb eases in, one beat after another: the
  // icon, the title, the description, the three counts, then the trend line
  // draws itself left to right (globals.css; off under reduced motion).
  // Keyed by the metric so stepping to another one replays it.
  const rise = (step: number): CSSProperties => ({ animationDelay: `${step * RISE_STEP_MS}ms` });
  return (
    <div className="mt-6 rounded-3xl border border-slate-200 bg-white px-6 pb-6 pt-5 dark:border-slate-700 dark:bg-slate-900">
      {breadcrumb}
      <div key={metric.key}>
        <div className="mt-5 flex items-start gap-3">
          <span
            style={{ ...rise(0), backgroundColor: `${color}1a`, color }}
            className="metric-rise mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          >
            <EventIcon category={metric.category} action={metric.action} type={metric.type} />
          </span>
          <div className="min-w-0">
            <h3
              style={rise(1)}
              className="metric-rise text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              {metric.label}
            </h3>
            <p
              style={rise(2)}
              className="metric-rise mt-0.5 text-sm text-slate-500 dark:text-slate-400"
            >
              {eventExplanation(metric.category, metric.action, metric.type)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {WINDOW_META.map((w, i) => (
            <div
              key={w.key}
              style={rise(3 + i)}
              className="metric-rise rounded-xl border border-slate-200 p-3 dark:border-slate-700"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {w.label}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                {(windowCounts[w.key].get(metric.key) ?? 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
          <p
            style={rise(4)}
            className="metric-rise text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            Daily Trend, Last 30 Days
          </p>
          <div style={rise(5)} className="metric-reveal mt-4">
            <TrendChart
              days={daily.days}
              values={series}
              color={color}
              highlightFromIndex={windowHighlightFrom(daily, active)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
