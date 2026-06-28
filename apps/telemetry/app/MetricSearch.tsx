'use client';

import { useMemo, useState } from 'react';
import { EmptyState } from '@livediagram/ui';
import type { TelemetryDaily, TelemetryWindow, TelemetryWindowKey } from '@livediagram/api-schema';
import { categoryColor, eventExplanation } from './event-vocab';
import { ActivityGlyph, SearchGlyph } from './glyphs';
import { buildMetrics, type Metric } from './metrics';
import { MetricPicker } from './MetricPicker';
import { EventIcon } from './telemetry-event-icon';
import { TrendChart } from './TrendChart';
import { buildWindowCounts, WINDOW_META, windowHighlightFrom } from './windows';

// The Search view (spec/22): find one specific event — by typing a query
// or by drilling category → action → type in the MetricPicker — then see
// just that metric charted over time. The metric universe is exactly the
// keys of `daily.byMetric`, so anything offered has a line to draw.

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
          windowCounts={windowCounts}
          daily={daily}
          active={active}
        />
      ) : (
        <div className="mt-6">
          <EmptyState
            icon={<SearchGlyph />}
            title="Pick a metric to chart it"
            description="Search any single event above, or browse by category, then select it to see its last 30 days as a trend line."
          />
        </div>
      )}
    </div>
  );
}

function SelectedMetric({
  metric,
  windowCounts,
  daily,
  active,
}: {
  metric: Metric;
  windowCounts: Record<TelemetryWindowKey, Map<string, number>>;
  daily: TelemetryDaily;
  active: TelemetryWindowKey;
}) {
  const color = categoryColor(metric.category);
  const series = daily.byMetric[metric.key] ?? [];
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          <EventIcon category={metric.category} action={metric.action} type={metric.type} />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {metric.label}
          </h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {eventExplanation(metric.category, metric.action, metric.type)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {WINDOW_META.map((w) => (
          <div key={w.key} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
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
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Daily trend — last 30 days
        </p>
        <div className="mt-4">
          <TrendChart
            days={daily.days}
            values={series}
            color={color}
            highlightFromIndex={windowHighlightFrom(daily, active)}
          />
        </div>
      </div>
    </div>
  );
}
