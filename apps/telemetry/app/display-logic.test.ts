import { describe, expect, it } from 'vitest';
import { ALL_VISITORS, EXCEPTIONS, NEW_VISITORS } from './metric-catalogue';
import { headlineMembers, headlineTotal, type MetricStack } from './metric-series';
import { readTrend } from './TrendBadge';
import { previousSpanLabel, rankTrend } from './windows';

// The dashboard's display decisions (spec/22), kept pure so they are tested
// apart from the components that render them.

describe('readTrend', () => {
  it('is green when a good metric rises and red when it falls', () => {
    expect(readTrend(12, 10)).toEqual({ tone: 'good', arrow: '▲', amount: '20%' });
    expect(readTrend(8, 10)).toEqual({ tone: 'bad', arrow: '▼', amount: '20%' });
  });

  it('flips for a bad metric: fewer errors is good news', () => {
    expect(readTrend(5, 10, 'bad')).toMatchObject({ tone: 'good', arrow: '▼' });
    expect(readTrend(15, 10, 'bad')).toMatchObject({ tone: 'bad', arrow: '▲' });
  });

  it('stays yellow for a neutral metric either way, and for no change', () => {
    expect(readTrend(20, 10, 'neutral').tone).toBe('neutral');
    expect(readTrend(10, 10)).toEqual({ tone: 'neutral', arrow: '→', amount: 'flat' });
  });

  it('shows a plain difference when there was nothing before', () => {
    expect(readTrend(7, 0).amount).toBe('7');
  });

  it('reads a sub-percent move as <1%, not 0%', () => {
    expect(readTrend(1001, 1000).amount).toBe('<1%');
  });
});

describe('headlineTotal', () => {
  const plain: MetricStack = {
    stack: true,
    title: 'T',
    blurb: '',
    members: [NEW_VISITORS, NEW_VISITORS],
  };

  it('sums every member by default', () => {
    expect(headlineTotal(plain, [3, 4])).toBe(7);
  });

  it('sums only the headline members when the stack names them', () => {
    // All Visitors: New + Returning, never the guest / signed-in split of Returning.
    expect(headlineTotal(ALL_VISITORS, [10, 20, 15, 5])).toBe(30);
    // Exceptions: failed requests + client exceptions, not the crashes that double them.
    expect(headlineTotal(EXCEPTIONS, [100, 3, 10, 1])).toBe(110);
  });

  it('has no total when a count it needs is missing', () => {
    expect(headlineTotal(plain, [3, null])).toBeNull();
    // A missing count outside the headline doesn't matter.
    expect(headlineTotal(ALL_VISITORS, [10, 20, null, null])).toBe(30);
  });
});

describe('headlineMembers', () => {
  it('marks what the head sums, so its combined line agrees with its number', () => {
    expect(headlineMembers(ALL_VISITORS)).toEqual([true, true, false, false]);
    expect(headlineMembers(EXCEPTIONS)).toEqual([true, false, true, false]);
  });
});

describe('the span a trend compares against', () => {
  const window = {
    total: 1,
    rows: [{ category: 'Participant', action: 'Created', type: null, count: 1 }],
  };
  const base = {
    enabled: true,
    generatedAt: 0,
    windows: { today: window, last7: window, last30: window },
  };
  const daily30 = { days: new Array(30).fill(0), totals: [], byCategory: {}, byMetric: {} };

  it('names the span for each window', () => {
    const summary = { ...base, previousWindows: base.windows };
    expect(previousSpanLabel(summary, 'today')).toBe('the day before');
    expect(previousSpanLabel(summary, 'last7')).toBe('the 7 days before');
    expect(previousSpanLabel(summary, 'last30')).toBe('the 30 days before');
  });

  it('has nothing behind the last 30 days from the daily series alone', () => {
    const summary = { ...base, daily: daily30 };
    expect(previousSpanLabel(summary, 'last7')).toBe('the 7 days before');
    expect(previousSpanLabel(summary, 'last30')).toBeNull();
  });

  it('gives rankings the previous rows only when the api sent them', () => {
    expect(rankTrend({ ...base, daily: daily30 }, 'last7')).toBeUndefined();
    expect(rankTrend({ ...base, previousWindows: base.windows }, 'last7')).toEqual({
      rows: window.rows,
      against: 'the 7 days before',
    });
  });
});
