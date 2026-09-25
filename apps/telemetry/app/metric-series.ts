import type { TelemetryDaily, TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import type { ViewKey } from './view-keys';

// The curated-metric model shared by every MetricGroups view (spec/22), plus
// the pure maths that turn one into a window count and a 30-day series.
//
// Whether a metric going up is good news, bad news, or neither. Drives the
// colour of its trend arrow (TrendBadge): green good, red bad, yellow neutral.
// Unset means good: most counts here are usage, and more usage is the aim.
export type Rising = 'good' | 'bad' | 'neutral';

// A curated metric is either a single typed event, or an AGGREGATE over every
// type of a `category·action` (`allTypes`) where the type split is arbitrary
// for the lens.
export type Metric = {
  category: string;
  action: string;
  // Further actions the metric also counts, beside `action` (a Settings
  // category spans Toggled rows and Changed rows). `action` stays the one its
  // icon and label show.
  actionIn?: readonly string[];
  type?: string | null; // specific type; ignored when allTypes
  allTypes?: boolean; // sum across every type of category·action
  // Sum across the types this picks (e.g. the page paths one app serves,
  // spec/150). Takes precedence over `type` / `allTypes`.
  typeIn?: (type: string | null) => boolean;
  title: string;
  blurb?: string; // overrides eventExplanation (needed for aggregates)
  rising?: Rising;
};

// A chart stack (spec/22): one head card plotting its members together, which
// fans out into the members' own cards. It only REFERENCES its members, so the
// same Metric can sit in several stacks or stand alone elsewhere.
export type MetricStack = {
  stack: true;
  title: string;
  blurb: string;
  members: Metric[];
  // The head's big number. By default the members' sum, which is right when
  // they partition one thing (new + returning visitors). Name the member, or
  // the members to sum, when the others are subsets of it, a different unit,
  // or the same events seen from another side (AI Requests over its own Ask /
  // Clean split; Exceptions' failed requests + client exceptions, not the
  // server crashes that double them), so the head never double counts.
  headline?: Metric | readonly Metric[];
  // A tab that goes deeper than the stack can (Page Views by App -> Pages),
  // linked from a full-width footer in the stack's modal.
  seeAlso?: { view: ViewKey; label: string };
  // How the head's number going up reads. Unset means good; a stack that
  // mixes good and bad members (sign-ups beside deletions) says neutral.
  rising?: Rising;
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
export function matches(m: Metric, category: string, action: string, type: string | null): boolean {
  if (category !== m.category) return false;
  if (action !== m.action && !m.actionIn?.includes(action)) return false;
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

/**
 * The metric's count over the same number of days just before the window, for
 * its trend arrow. From the api's `previousWindows` when it sends them (every
 * window, the last 30 included); otherwise from the 30-day series, which can't
 * reach behind the 30-day window, so that one is null.
 */
export function previousCount(
  summary: TelemetrySummary,
  active: TelemetryWindowKey,
  m: Metric,
  windowDays: number,
): number | null {
  const previous = summary.previousWindows?.[active];
  if (previous) {
    return previous.rows
      .filter((r) => matches(m, r.category, r.action, r.type))
      .reduce((sum, r) => sum + r.count, 0);
  }
  if (!summary.daily) return null;
  const series = dailySeries(summary.daily, m);
  const n = series.length;
  if (n - 2 * windowDays < 0) return null;
  return series.slice(n - 2 * windowDays, n - windowDays).reduce((a, b) => a + b, 0);
}

// One colour per stack member, in order. Owned by the stack's rendering, not
// the chart, since the same chart can sit in stacks beside different company.
// Distinct hues from the brand-adjacent palette, readable on light and dark.
const STACK_SERIES_COLORS = ['#0ea5e9', '#f59e0b', '#8b5cf6', '#10b981', '#ec4899'];

export const stackSeriesColor = (index: number): string =>
  STACK_SERIES_COLORS[index % STACK_SERIES_COLORS.length]!;

// The most members a stack's head draws as separate lines, one colour each.
// A bigger stack draws its combined line instead, and its members' cards keep
// their own category colour since no head line matches them.
export const MAX_STACK_LINES = STACK_SERIES_COLORS.length;

export const stackDrawsLines = (members: number): boolean => members <= MAX_STACK_LINES;
