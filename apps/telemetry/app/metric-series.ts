import type { TelemetryDaily, TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';

// The curated-metric model shared by every MetricGroups view (spec/22), plus
// the pure maths that turn one into a window count and a 30-day series.
//
// A curated metric is either a single typed event, or an AGGREGATE over every
// type of a `category·action` (`allTypes`) where the type split is arbitrary
// for the lens.
export type Metric = {
  category: string;
  action: string;
  type?: string | null; // specific type; ignored when allTypes
  allTypes?: boolean; // sum across every type of category·action
  // Sum across the types this picks (e.g. the page paths one app serves,
  // spec/150). Takes precedence over `type` / `allTypes`.
  typeIn?: (type: string | null) => boolean;
  title: string;
  blurb?: string; // overrides eventExplanation (needed for aggregates)
};

// A chart stack (spec/22): one head card plotting its members together, which
// fans out into the members' own cards. It only REFERENCES its members, so the
// same Metric can sit in several stacks or stand alone elsewhere.
export type MetricStack = {
  stack: true;
  title: string;
  blurb: string;
  members: Metric[];
};

export type MetricGroupItem = Metric | MetricStack;

export type MetricGroup = { title: string; metrics: MetricGroupItem[] };

export const isStack = (item: MetricGroupItem): item is MetricStack => 'stack' in item;

// Every chart a group shows, stacks opened up: what the emitter test checks.
export const groupMetrics = (group: MetricGroup): Metric[] =>
  group.metrics.flatMap((item) => (isStack(item) ? item.members : [item]));

// Is the metric an aggregate (no single type to show on its icon + label)?
export const isAggregate = (m: Metric): boolean => Boolean(m.allTypes || m.typeIn);

export const metricKey = (m: Metric): string =>
  `${m.category}|${m.action}|${isAggregate(m) ? `*${m.title}` : (m.type ?? '')}`;

// Does an event (category, action, type) belong to this metric?
function matches(m: Metric, category: string, action: string, type: string | null): boolean {
  if (category !== m.category || action !== m.action) return false;
  if (m.typeIn) return m.typeIn(type);
  return m.allTypes ? true : type === (m.type ?? null);
}

// Selected-window count: sum the window's rows that belong to the metric (one
// row for a single typed metric, several for an aggregate).
export function windowCount(
  summary: TelemetrySummary,
  active: TelemetryWindowKey,
  m: Metric,
): number {
  return summary.windows[active].rows
    .filter((r) => matches(m, r.category, r.action, r.type))
    .reduce((sum, r) => sum + r.count, 0);
}

// Element-wise sum of the 30-day series for every event in the metric.
export function dailySeries(daily: TelemetryDaily, m: Metric): number[] {
  const out = new Array(daily.days.length).fill(0);
  for (const [key, series] of Object.entries(daily.byMetric)) {
    const [category = '', action = '', rawType = ''] = key.split('|');
    if (!matches(m, category, action, rawType === '' ? null : rawType)) continue;
    for (let i = 0; i < out.length; i++) out[i] += series[i] ?? 0;
  }
  return out;
}

// One colour per stack member, in order. Owned by the stack's rendering, not
// the chart, since the same chart can sit in stacks beside different company.
// Distinct hues from the brand-adjacent palette, readable on light and dark.
const STACK_SERIES_COLORS = ['#0ea5e9', '#f59e0b', '#8b5cf6', '#10b981', '#ec4899'];

export const stackSeriesColor = (index: number): string =>
  STACK_SERIES_COLORS[index % STACK_SERIES_COLORS.length]!;
