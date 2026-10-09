// Timing telemetry (docs/specs/017-telemetry/timing-telemetry.md): how long the key moments of the
// experience take, sent as `Timing·Measured·<Metric>.<Bucket>`. The duration is bucketed in the
// browser, so the raw number never leaves it and the `type` stays a closed token.
//
// One definition for every emitter (the editor's own timings, every app's Web Vitals), the ingest
// validator (isTimingType) and the dashboard (the bucket bounds it turns back into percentiles), so a
// bucket the dashboard cannot read can never be sent.

import type { PageViewApp } from './page-views';

/** A scale: ascending upper bounds, the last bucket being everything past the final bound. */
export type TimingScale = {
  bounds: readonly number[];
  // The unit a bucket token spells its bound in: 'ms' for durations, '' for the unitless CLS.
  unit: 'ms' | '';
};

export const TIMING_SCALES = {
  Duration: { bounds: [100, 250, 500, 1000, 2000, 4000, 8000, 15000, 30000], unit: 'ms' },
  // Google's thresholds sit exactly on a bound (LCP good 2500 / poor 4000, INP 200 / 500, CLS 0.1 /
  // 0.25), so the dashboard rates a p75 against them without guessing inside a bucket.
  Lcp: { bounds: [500, 1000, 1500, 2500, 4000, 6000, 10000], unit: 'ms' },
  Inp: { bounds: [50, 100, 200, 300, 500, 1000], unit: 'ms' },
  Cls: { bounds: [0.01, 0.05, 0.1, 0.25, 0.5], unit: '' },
} as const satisfies Record<string, TimingScale>;
export type TimingScaleKey = keyof typeof TIMING_SCALES;

/** Google's "good" and "poor" thresholds for the three Core Web Vitals, on their own scales. */
export const WEB_VITAL_THRESHOLDS = {
  Lcp: { good: 2500, poor: 4000 },
  Inp: { good: 200, poor: 500 },
  Cls: { good: 0.1, poor: 0.25 },
} as const;
export type WebVital = keyof typeof WEB_VITAL_THRESHOLDS;
export const WEB_VITALS: readonly WebVital[] = ['Lcp', 'Inp', 'Cls'];

/** The editor's own timings, each on the Duration scale. */
export const EDITOR_TIMING_METRICS = [
  'DocumentLoad',
  'TabLoad',
  'Save',
  'RoomConnect',
  'RoomReconnect',
] as const;
export type EditorTimingMetric = (typeof EDITOR_TIMING_METRICS)[number];

/** The apps whose pages report Web Vitals: every frontend, named as page views name them. */
export const WEB_VITAL_APPS: readonly PageViewApp[] = [
  'Marketing',
  'Live',
  'Help',
  'Dashboard',
  'Community',
];

/** A Web Vitals metric token: `Lcp.Marketing`, `Inp.Live`. */
export const webVitalMetric = (vital: WebVital, app: PageViewApp): string => `${vital}.${app}`;

/** Every metric token, with the scale it reads on. */
export const TIMING_METRICS: ReadonlyMap<string, TimingScaleKey> = new Map<string, TimingScaleKey>([
  ...EDITOR_TIMING_METRICS.map((m) => [m, 'Duration'] as [string, TimingScaleKey]),
  ...WEB_VITALS.flatMap((vital) =>
    WEB_VITAL_APPS.map((app) => [webVitalMetric(vital, app), vital] as [string, TimingScaleKey]),
  ),
]);

// A bound as a token part: 500 -> '500ms', 0.1 -> '0p1' (the dot separates the type's parts).
const boundToken = (bound: number, unit: TimingScale['unit']): string =>
  `${String(bound).replace('.', 'p')}${unit}`;

export type TimingBucket = {
  token: string; // 'Under500ms', 'Over30000ms'
  lower: number; // inclusive; 0 for the first bucket
  upper: number | null; // exclusive; null for the open last bucket
};

const bucketCache = new Map<TimingScaleKey, readonly TimingBucket[]>();

/** A scale's buckets in ascending order, the open `Over` bucket last. */
export function timingBuckets(scale: TimingScaleKey): readonly TimingBucket[] {
  const cached = bucketCache.get(scale);
  if (cached) return cached;
  const { bounds, unit } = TIMING_SCALES[scale];
  const buckets: TimingBucket[] = bounds.map((upper, i) => ({
    token: `Under${boundToken(upper, unit)}`,
    lower: i === 0 ? 0 : bounds[i - 1]!,
    upper,
  }));
  const last = bounds[bounds.length - 1]!;
  buckets.push({ token: `Over${boundToken(last, unit)}`, lower: last, upper: null });
  bucketCache.set(scale, buckets);
  return buckets;
}

/** The bucket a value falls in: the first whose bound it is under, else the open last one. */
export function timingBucket(scale: TimingScaleKey, value: number): string {
  const buckets = timingBuckets(scale);
  const hit = buckets.find((b) => b.upper !== null && value < b.upper);
  return (hit ?? buckets[buckets.length - 1]!).token;
}

/**
 * The `type` for one timing: `<Metric>.<Bucket>`. Null for an unknown metric or a value that is not a
 * finite, non-negative number, so a bad clock reading is dropped rather than sent.
 */
export function timingType(metric: string, value: number): string | null {
  const scale = TIMING_METRICS.get(metric);
  if (!scale || !Number.isFinite(value) || value < 0) return null;
  return `${metric}.${timingBucket(scale, value)}`;
}

/** Split a `type` into its metric and bucket, or null when it is not a timing type. */
export function parseTimingType(
  type: string | null | undefined,
): { metric: string; bucket: TimingBucket; scale: TimingScaleKey } | null {
  if (typeof type !== 'string') return null;
  const dot = type.lastIndexOf('.');
  if (dot <= 0) return null;
  const metric = type.slice(0, dot);
  const scale = TIMING_METRICS.get(metric);
  if (!scale) return null;
  const token = type.slice(dot + 1);
  const bucket = timingBuckets(scale).find((b) => b.token === token);
  return bucket ? { metric, bucket, scale } : null;
}

/** Is this a `type` the `Timing` category accepts? The ingest's closed-vocabulary check. */
export function isTimingType(type: unknown): type is string {
  return parseTimingType(type as string) !== null;
}

/** Every timing type a metric can send, in bucket order. */
export function timingTypesOf(metric: string): string[] {
  const scale = TIMING_METRICS.get(metric);
  return scale ? timingBuckets(scale).map((b) => `${metric}.${b.token}`) : [];
}

/** Every timing type that exists. */
export const ALL_TIMING_TYPES: readonly string[] = [...TIMING_METRICS.keys()].flatMap(
  timingTypesOf,
);
