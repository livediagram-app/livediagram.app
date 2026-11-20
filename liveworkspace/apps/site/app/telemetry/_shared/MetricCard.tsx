'use client';

import { useTelemetryApp } from './app';
import { eventLabel } from './event-vocab';
import { isAggregate, type Metric } from './metric-series';
import { StatCard, StatValue } from './StatCard';
import { EventIcon } from './telemetry-event-icon';
import { TrendBadge } from './TrendBadge';
import { TrendChart } from './TrendChart';
import { useCategoryColor } from './useCategoryColor';

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
  color: override,
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
  const tone = useCategoryColor();
  const { explain } = useTelemetryApp();
  const color = override ?? tone(m.category);
  // An aggregate has no single type, so the icon + label drop the type.
  const iconType = isAggregate(m) ? null : (m.type ?? null);
  return (
    <StatCard
      icon={<EventIcon category={m.category} action={m.action} type={iconType} />}
      color={color}
      title={m.title}
      subtitle={`${m.category} · ${eventLabel({ action: m.action, type: iconType })}`}
      aside={
        <>
          {previous !== null && against ? (
            <TrendBadge now={count} before={previous} rising={m.rising} against={against} />
          ) : null}
          <StatValue>{count.toLocaleString()}</StatValue>
        </>
      }
      // Plain-language meaning. Aggregates carry their own blurb; single
      // metrics reuse the shared event explanation copy.
      blurb={m.blurb ?? explain(m.category, m.action, iconType)}
    >
      {days ? (
        <TrendChart
          days={days}
          values={series ?? days.map(() => 0)}
          color={color}
          highlightFromIndex={highlightFromIndex}
          heightClassName="h-20"
          label={m.title}
        />
      ) : null}
    </StatCard>
  );
}
