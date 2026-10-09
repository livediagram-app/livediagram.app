import { describe, expect, it } from 'vitest';
import { metricKey, timingBuckets, type TelemetryCount } from '@livediagram/api-schema';
import {
  bucketLabel,
  dailyP75,
  formatPercentile,
  formatTiming,
  timingHistogram,
  timingPercentile,
  vitalRating,
} from './timing-stats';
import { timingSentence } from './timing-explanation';
import { eventExplanation } from './event-explanation';

// The Timings tab's maths (docs/specs/017-telemetry/timing-telemetry.md).

const row = (type: string, count: number): TelemetryCount => ({
  category: 'Timing',
  action: 'Measured',
  type,
  count,
});

describe('timingHistogram', () => {
  it("collects one metric's buckets in order, ignoring every other event", () => {
    const h = timingHistogram(
      [
        row('Save.Under500ms', 3),
        row('Save.Under100ms', 1),
        row('Save.Under500ms', 2),
        row('TabLoad.Under100ms', 9),
        { category: 'Error', action: 'Api', type: 'Save.Under100ms', count: 9 },
        row('Save.Nonsense', 9),
      ],
      'Save',
    );
    expect(h.total).toBe(6);
    expect(h.buckets.map((b) => b.count)).toEqual([1, 0, 5, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('reads an unknown metric as empty', () => {
    expect(timingHistogram([row('Save.Under100ms', 1)], 'Nope').total).toBe(0);
  });
});

describe('timingPercentile', () => {
  const h = (counts: Record<string, number>) =>
    timingHistogram(
      Object.entries(counts).map(([t, n]) => row(`DocumentLoad.${t}`, n)),
      'DocumentLoad',
    );

  it('interpolates inside the bucket holding the percentile', () => {
    // 100 timings, all between 500 and 1000 ms: the median is halfway.
    expect(timingPercentile(h({ Under1000ms: 100 }), 0.5)).toEqual({ value: 750, open: false });
    // 50 under 500 ms, 50 in 500..1000: p75 is halfway through the second bucket.
    expect(timingPercentile(h({ Under500ms: 50, Under1000ms: 50 }), 0.75)).toEqual({
      value: 750,
      open: false,
    });
  });

  it('reads "over" the last bound when the percentile is in the open bucket', () => {
    expect(timingPercentile(h({ Under1000ms: 10, Over30000ms: 90 }), 0.95)).toEqual({
      value: 30000,
      open: true,
    });
  });

  it('is null with no timings, and holds q to 0..1', () => {
    expect(timingPercentile(h({}), 0.5)).toBeNull();
    expect(timingPercentile(h({ Under250ms: 4 }), 2)).toEqual({ value: 250, open: false });
    expect(timingPercentile(h({ Under250ms: 4 }), -1)).toEqual({ value: 100, open: false });
  });
});

describe('dailyP75', () => {
  it("reads each day's p75, a gap on a day with too few timings", () => {
    const tokens = timingBuckets('Duration').map((b) => b.token);
    const days = [0, 1, 2];
    const byMetric: Record<string, number[]> = {
      [metricKey('Timing', 'Measured', `Save.${tokens[2]}`)]: [10, 1, 0],
      [metricKey('Timing', 'Measured', `Save.${tokens[9]}`)]: [0, 0, 8],
    };
    const series = dailyP75({ days, totals: [], byCategory: {}, byMetric }, 'Save');
    expect(series[0]).toBeCloseTo(437.5);
    expect(series[1]).toBeNull();
    expect(series[2]).toBe(30000);
  });

  it('reads an unknown metric as no days', () => {
    expect(dailyP75({ days: [0], totals: [], byCategory: {}, byMetric: {} }, 'Nope')).toEqual([
      null,
    ]);
  });
});

describe('vitalRating', () => {
  it("rates a p75 against Google's thresholds", () => {
    expect(vitalRating('Lcp', { value: 2500, open: false })).toBe('Good');
    expect(vitalRating('Lcp', { value: 3000, open: false })).toBe('Needs Work');
    expect(vitalRating('Lcp', { value: 4001, open: false })).toBe('Poor');
    expect(vitalRating('Cls', { value: 0.5, open: true })).toBe('Poor');
    expect(vitalRating('Inp', { value: 150, open: false })).toBe('Good');
  });
});

describe('formatting', () => {
  it('reads milliseconds, seconds and layout shift scores', () => {
    expect(formatTiming('Duration', 120.4)).toBe('120 ms');
    expect(formatTiming('Duration', 1440)).toBe('1.4 s');
    expect(formatTiming('Duration', 2000)).toBe('2 s');
    expect(formatTiming('Duration', 30000)).toBe('30 s');
    expect(formatTiming('Cls', 0.083)).toBe('0.08');
    expect(formatTiming('Cls', 0.004)).toBe('0.004');
  });

  it('says over for the open bucket and names an empty percentile', () => {
    expect(formatPercentile('Duration', { value: 30000, open: true })).toBe('over 30 s');
    expect(formatPercentile('Duration', { value: 800, open: false })).toBe('800 ms');
    expect(formatPercentile('Duration', null)).toBe('No timings');
  });

  it('labels a bucket by its bound', () => {
    const [first, ...rest] = timingBuckets('Duration');
    expect(bucketLabel('Duration', first!)).toBe('under 100 ms');
    expect(bucketLabel('Duration', rest.at(-1)!)).toBe('over 30 s');
  });
});

describe('timing sentences', () => {
  it('names the moment and its range', () => {
    expect(eventExplanation('Timing', 'Measured', 'DocumentLoad.Under1000ms')).toBe(
      'A document opened in under 1 s.',
    );
    expect(eventExplanation('Timing', 'Measured', 'Lcp.Marketing.Under2500ms')).toBe(
      'A page on the Marketing site had its main content showing in under 2.5 s.',
    );
    expect(eventExplanation('Timing', 'Measured', 'Cls.Help.Under0p1')).toBe(
      'A page on the Help site shifted its layout by a total under 0.10.',
    );
  });

  it('falls back for a type that is not a timing, or a vital it does not know', () => {
    expect(eventExplanation('Timing', 'Measured', 'Nope')).toMatch(/^A key moment was timed/);
    expect(
      timingSentence({
        metric: 'Fcp.Live',
        bucket: timingBuckets('Duration')[0]!,
        scale: 'Duration',
      }),
    ).toBe('A page on the Live site was timed in under 100 ms.');
  });
});
