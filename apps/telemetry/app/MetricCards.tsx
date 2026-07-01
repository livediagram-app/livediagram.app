'use client';

import type { TelemetryDaily, TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { categoryColor, eventExplanation, eventLabel } from './event-vocab';
import { EventIcon } from './telemetry-event-icon';
import { TrendChart } from './TrendChart';
import { windowHighlightFrom } from './windows';

// A curated metric rendered as a card: the selected-window count + a 30-day
// trend line. Either a single typed event, or an AGGREGATE over every type of
// a `category·action` (`allTypes`) where the type split is arbitrary for the
// lens. Shared by the Highlights, Acquisition, and External Connections views
// so each is just a list of metric groups rendered identically.
export type Metric = {
  category: string;
  action: string;
  type?: string | null; // specific type; ignored when allTypes
  allTypes?: boolean; // sum across every type of category·action
  title: string;
  blurb?: string; // overrides eventExplanation (needed for aggregates)
};

export type MetricGroup = { title: string; metrics: Metric[] };

// Does an event (category, action, type) belong to this metric?
function matches(m: Metric, category: string, action: string, type: string | null): boolean {
  if (category !== m.category || action !== m.action) return false;
  return m.allTypes ? true : type === (m.type ?? null);
}

// Selected-window count: sum the window's rows that belong to the metric (one
// row for a single typed metric, several for an aggregate).
function windowCount(summary: TelemetrySummary, active: TelemetryWindowKey, m: Metric): number {
  return summary.windows[active].rows
    .filter((r) => matches(m, r.category, r.action, r.type))
    .reduce((sum, r) => sum + r.count, 0);
}

// Element-wise sum of the 30-day series for every event in the metric.
function dailySeries(daily: TelemetryDaily, m: Metric): number[] {
  const out = new Array(daily.days.length).fill(0);
  for (const [key, series] of Object.entries(daily.byMetric)) {
    const [category = '', action = '', rawType = ''] = key.split('|');
    if (!matches(m, category, action, rawType === '' ? null : rawType)) continue;
    for (let i = 0; i < out.length; i++) out[i] += series[i] ?? 0;
  }
  return out;
}

export function MetricGroups({
  groups,
  summary,
  active,
}: {
  groups: MetricGroup[];
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const daily = summary.daily;
  return (
    <div className="mt-6 flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.title}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {group.title}
          </h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.metrics.map((m) => (
              <MetricCard
                key={`${m.category}|${m.action}|${m.allTypes ? '*' : (m.type ?? '')}`}
                metric={m}
                count={windowCount(summary, active, m)}
                series={daily ? dailySeries(daily, m) : undefined}
                days={daily?.days}
                highlightFromIndex={daily ? windowHighlightFrom(daily, active) : null}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MetricCard({
  metric: m,
  count,
  series,
  days,
  highlightFromIndex,
}: {
  metric: Metric;
  count: number;
  series: number[] | undefined;
  days: number[] | undefined;
  highlightFromIndex: number | null;
}) {
  const color = categoryColor(m.category);
  // An aggregate has no single type, so the icon + label drop the type.
  const iconType = m.allTypes ? null : (m.type ?? null);
  return (
    // `flex h-full flex-col` + `mt-auto` on the chart pins every trend line to
    // the bottom of the card. Grid rows already stretch cards to equal height,
    // so without this a longer blurb (e.g. an aggregate's) would push its chart
    // down and misalign it with the shorter cards beside it in the same row.
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}1a`, color }}
          >
            <EventIcon category={m.category} action={m.action} type={iconType} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{m.title}</p>
            <p className="text-xs text-slate-400">
              {m.category} · {eventLabel({ action: m.action, type: iconType })}
            </p>
          </div>
        </div>
        <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {count.toLocaleString()}
        </span>
      </div>
      {/* Plain-language meaning. Aggregates carry their own blurb; single
          metrics reuse the Raw view's row tooltip copy. */}
      <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {m.blurb ?? eventExplanation(m.category, m.action, iconType)}
      </p>
      {days ? (
        <div className="mt-auto pt-4">
          <TrendChart
            days={days}
            values={series ?? new Array(days.length).fill(0)}
            color={color}
            highlightFromIndex={highlightFromIndex}
            heightClassName="h-20"
          />
        </div>
      ) : null}
    </div>
  );
}
