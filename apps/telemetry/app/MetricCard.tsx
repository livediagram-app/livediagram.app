'use client';

import { eventExplanation } from './event-explanation';
import { categoryColor, eventLabel } from './event-vocab';
import { isAggregate, type Metric } from './metric-series';
import { EventIcon } from './telemetry-event-icon';
import { TrendBadge } from './TrendBadge';
import { TrendChart } from './TrendChart';

// One curated metric as a card: the selected-window count + a 30-day trend
// line. `color` overrides the category colour, so a card fanned out of a chart
// stack wears the colour its line had in the stack's combined chart.
export function MetricCard({
  metric: m,
  count,
  series,
  days,
  highlightFromIndex,
  previous,
  against,
  color = categoryColor(m.category),
}: {
  metric: Metric;
  count: number;
  series: number[] | undefined;
  days: number[] | undefined;
  highlightFromIndex: number | null;
  // The count over the span just before the window, and that span's name, for
  // the trend arrow. Null when there's nothing to compare against.
  previous: number | null;
  against: string | null;
  color?: string;
}) {
  // An aggregate has no single type, so the icon + label drop the type.
  const iconType = isAggregate(m) ? null : (m.type ?? null);
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
        <div className="flex shrink-0 items-center gap-2">
          {previous !== null && against ? (
            <TrendBadge now={count} before={previous} rising={m.rising} against={against} />
          ) : null}
          <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {count.toLocaleString()}
          </span>
        </div>
      </div>
      {/* Plain-language meaning. Aggregates carry their own blurb; single
          metrics reuse the shared event explanation copy. */}
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
