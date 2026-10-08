// The Timings tab's maths (docs/specs/017-telemetry/timing-telemetry.md): turn the window's
// `Timing·Measured·<Metric>.<Bucket>` counts back into a histogram, estimate percentiles from it, and
// rate a Web Vital against Google's thresholds. Pure, so the tab only renders.

import {
  metricKey,
  parseTimingType,
  TIMING_METRICS,
  timingBuckets,
  WEB_VITAL_THRESHOLDS,
  type TelemetryCount,
  type TelemetryDaily,
  type TimingBucket,
  type TimingScaleKey,
  type WebVital,
} from '@livediagram/api-schema';

/** Fewer timings than this and a card says so rather than quoting a percentile. */
export const TIMING_MIN_SAMPLES = 20;
/** A day with fewer timings than this leaves a gap in the daily p75 line. */
export const TIMING_MIN_DAILY_SAMPLES = 5;

export type TimingHistogram = {
  scale: TimingScaleKey;
  buckets: { bucket: TimingBucket; count: number }[];
  total: number;
};

/** One metric's buckets, in order, with the window's count in each. */
export function timingHistogram(rows: readonly TelemetryCount[], metric: string): TimingHistogram {
  const scale = TIMING_METRICS.get(metric) ?? 'Duration';
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.category !== 'Timing' || r.action !== 'Measured') continue;
    const parsed = parseTimingType(r.type);
    if (parsed?.metric !== metric) continue;
    counts.set(parsed.bucket.token, (counts.get(parsed.bucket.token) ?? 0) + r.count);
  }
  const buckets = timingBuckets(scale).map((bucket) => ({
    bucket,
    count: counts.get(bucket.token) ?? 0,
  }));
  return { scale, buckets, total: buckets.reduce((sum, b) => sum + b.count, 0) };
}

/**
 * An estimated percentile (`q` in 0..1): walk the buckets to the one holding it and interpolate
 * linearly inside it. In the open last bucket there is no upper bound to interpolate to, so the
 * answer is that bucket's lower bound with `open` set: "over 30 s", never a made-up number.
 */
export function timingPercentile(
  histogram: TimingHistogram,
  q: number,
): { value: number; open: boolean } | null {
  const filled = histogram.buckets.filter((b) => b.count > 0);
  if (filled.length === 0) return null;
  const target = Math.min(1, Math.max(0, q)) * histogram.total;
  // The bucket holding the target: the first whose running count reaches it, the last at the latest.
  let before = 0;
  let at = 0;
  while (at < filled.length - 1 && before + filled[at]!.count < target)
    before += filled[at++]!.count;
  const { bucket, count } = filled[at]!;
  if (bucket.upper === null) return { value: bucket.lower, open: true };
  const within = Math.min(1, (target - before) / count);
  return { value: bucket.lower + within * (bucket.upper - bucket.lower), open: false };
}

/** The p75 of each day in the 30-day series, null on a day with too few timings to read. */
export function dailyP75(daily: TelemetryDaily, metric: string): (number | null)[] {
  const scale = TIMING_METRICS.get(metric) ?? 'Duration';
  const buckets = timingBuckets(scale);
  const series = buckets.map(
    (b) => daily.byMetric[metricKey('Timing', 'Measured', `${metric}.${b.token}`)],
  );
  return daily.days.map((_, day) => {
    const histogram: TimingHistogram = {
      scale,
      buckets: buckets.map((bucket, i) => ({ bucket, count: series[i]?.[day] ?? 0 })),
      total: 0,
    };
    histogram.total = histogram.buckets.reduce((sum, b) => sum + b.count, 0);
    if (histogram.total < TIMING_MIN_DAILY_SAMPLES) return null;
    return timingPercentile(histogram, 0.75)?.value ?? null;
  });
}

export type VitalRating = 'Good' | 'Needs Work' | 'Poor';

/** A Web Vital's p75 against Google's thresholds. */
export function vitalRating(vital: WebVital, p75: { value: number; open: boolean }): VitalRating {
  const { good, poor } = WEB_VITAL_THRESHOLDS[vital];
  if (p75.open || p75.value > poor) return 'Poor';
  return p75.value > good ? 'Needs Work' : 'Good';
}

/** A value as people read it: '120 ms', '1.4 s', a CLS score '0.08'. */
export function formatTiming(scale: TimingScaleKey, value: number): string {
  if (scale === 'Cls') return value < 0.01 ? value.toFixed(3) : value.toFixed(2);
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0).replace(/\.0$/, '')} s`;
}

/** A percentile as a card shows it: 'about 0.8 s', or 'over 30 s' in the open bucket. */
export function formatPercentile(
  scale: TimingScaleKey,
  p: { value: number; open: boolean } | null,
): string {
  if (!p) return 'No timings';
  return p.open ? `over ${formatTiming(scale, p.value)}` : formatTiming(scale, p.value);
}

/** A bucket's label for a bar: 'under 500 ms', 'over 30 s'. */
export function bucketLabel(scale: TimingScaleKey, bucket: TimingBucket): string {
  return bucket.upper === null
    ? `over ${formatTiming(scale, bucket.lower)}`
    : `under ${formatTiming(scale, bucket.upper)}`;
}
