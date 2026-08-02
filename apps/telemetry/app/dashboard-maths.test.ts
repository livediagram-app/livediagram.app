import { describe, expect, it } from 'vitest';
import { metricKey, type TelemetryDaily, type TelemetryWindow } from '@livediagram/api-schema';
import { pct } from './chart-utils';
import { buildMetrics } from './metrics';
import { WINDOW_META, buildWindowCounts, windowHighlightFrom, windowLabel } from './windows';

// The arithmetic behind the public dashboard (spec/22). It is public and
// indexable, so a wrong number here is wrong in the open — and none of these
// helpers had a test: the app's only suite covers the event vocabulary.
//
// The interesting cases are all degenerate inputs. This data comes from an api
// that aggregates whatever happened, so an empty day, a metric with no type,
// and a summary from an older api revision are all normal traffic rather than
// edge cases someone has to contrive.

const daily = (byMetric: Record<string, number[]>, days: number[] = []): TelemetryDaily =>
  ({ days, byMetric }) as unknown as TelemetryDaily;

const window_ = (
  rows: { category: string; action: string; type: string | null; count: number }[],
) => ({ rows }) as unknown as TelemetryWindow;

describe('pct', () => {
  it('is a plain percentage, left unrounded for the caller', () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(1, 3)).toBeCloseTo(33.333, 3);
  });

  it('is zero for a zero part', () => {
    expect(pct(0, 10)).toBe(0);
  });

  it('returns a non-finite value for a zero whole rather than pretending', () => {
    // A bar with no total is a real state on a quiet day. This documents that
    // the guard belongs to the CALLER: anything rendering pct() into a width
    // or a label has to handle it, because NaN reaches the DOM silently and
    // Infinity draws a bar off the end of the chart.
    expect(Number.isFinite(pct(0, 0))).toBe(false);
    expect(Number.isFinite(pct(5, 0))).toBe(false);
  });
});

describe('buildMetrics', () => {
  it('ranks by the 30-day total, biggest first', () => {
    const m = buildMetrics(daily({ 'A|Used|X': [1, 1], 'B|Used|Y': [5], 'C|Used|Z': [2, 2] }));
    expect(m.map((x) => x.key)).toEqual(['B|Used|Y', 'C|Used|Z', 'A|Used|X']);
    expect(m[0]!.total30).toBe(5);
  });

  it('splits the composite key back into its three parts', () => {
    const [m] = buildMetrics(daily({ 'Element|Added|Square': [1] }));
    expect([m!.category, m!.action, m!.type]).toEqual(['Element', 'Added', 'Square']);
  });

  it('reads a missing type as null, not as an empty string', () => {
    // `category|action|` is how the api encodes an event with no type. A ''
    // here would render as a stray separator in the label and never match a
    // null-typed row in the window counts.
    const [m] = buildMetrics(daily({ 'Diagram|Created|': [1] }));
    expect(m!.type).toBeNull();
  });

  it('sums an empty series to zero rather than dropping the metric', () => {
    const m = buildMetrics(daily({ 'A|Used|X': [] }));
    expect(m).toHaveLength(1);
    expect(m[0]!.total30).toBe(0);
  });

  it('finds nothing, rather than throwing, when byMetric is absent', () => {
    // A summary from an api revision that predates byMetric. The dashboard is
    // deployed separately from the worker, so this really can happen mid-roll.
    expect(buildMetrics({ days: [] } as unknown as TelemetryDaily)).toEqual([]);
  });
});

describe('windowHighlightFrom', () => {
  const thirtyDays = daily(
    {},
    Array.from({ length: 30 }, (_, i) => i),
  );

  it('highlights just the final day for Today', () => {
    expect(windowHighlightFrom(thirtyDays, 'today')).toBe(29);
  });

  it('highlights the trailing week for Last 7', () => {
    expect(windowHighlightFrom(thirtyDays, 'last7')).toBe(23);
  });

  it('highlights the whole line for Last month', () => {
    expect(windowHighlightFrom(thirtyDays, 'last30')).toBe(0);
  });

  it('never returns a negative index for a series shorter than the window', () => {
    // A brand-new deployment has only a few days of history. A negative index
    // would slice from the end and highlight the wrong span.
    const short = daily({}, [1, 2]);
    for (const { key } of WINDOW_META) {
      expect(windowHighlightFrom(short, key)).toBeGreaterThanOrEqual(0);
    }
    expect(windowHighlightFrom(daily({}, []), 'last7')).toBe(0);
  });
});

describe('windowLabel', () => {
  it('names every window the dashboard offers', () => {
    expect(WINDOW_META.map((w) => windowLabel(w.key))).toEqual([
      'Today',
      'Last 7 days',
      'Last month',
    ]);
  });

  it('falls back to the key itself for one it does not know', () => {
    expect(windowLabel('last90' as never)).toBe('last90');
  });
});

describe('buildWindowCounts', () => {
  const windows = {
    today: window_([{ category: 'Element', action: 'Added', type: 'Square', count: 3 }]),
    last7: window_([{ category: 'Element', action: 'Added', type: 'Square', count: 9 }]),
    last30: window_([
      { category: 'Element', action: 'Added', type: 'Square', count: 40 },
      { category: 'Diagram', action: 'Created', type: null, count: 7 },
    ]),
  };

  it('keys each window by the same metricKey the metrics use', () => {
    // The two sides are built independently and joined by this key, so they
    // have to agree on how a null type is encoded.
    const counts = buildWindowCounts(windows);
    const key = metricKey('Element', 'Added', 'Square');
    expect(counts.today.get(key)).toBe(3);
    expect(counts.last7.get(key)).toBe(9);
    expect(counts.last30.get(key)).toBe(40);
  });

  it('handles a null type the same way on both sides of the join', () => {
    const counts = buildWindowCounts(windows);
    const [m] = buildMetrics(daily({ [metricKey('Diagram', 'Created', null)]: [7] }));
    expect(counts.last30.get(m!.key)).toBe(7);
  });

  it('reports a missing metric as undefined, not zero', () => {
    // The caller distinguishes "no events in this window" from "not a metric",
    // so the lookup must not invent a zero.
    const counts = buildWindowCounts(windows);
    expect(counts.today.get(metricKey('Diagram', 'Created', null))).toBeUndefined();
  });

  it('builds a map for every window even when one is empty', () => {
    const counts = buildWindowCounts({
      today: window_([]),
      last7: window_([]),
      last30: window_([]),
    });
    for (const { key } of WINDOW_META) expect(counts[key].size).toBe(0);
  });
});
