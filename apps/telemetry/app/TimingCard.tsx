'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import type { TimingChart } from './catalogue/timings';
import {
  bucketLabel,
  dailyP75,
  formatPercentile,
  formatTiming,
  TIMING_MIN_SAMPLES,
  timingHistogram,
  timingPercentile,
} from './timing-stats';
import { useCategoryColor } from './useCategoryColor';

// One editor timing as a card (docs/specs/017-telemetry/timing-telemetry.md): the window's estimated
// p75 as the headline, the median and p95 beside it, how many timings it is drawn from, the bucket
// bars, and each day's p75 across the 30 days.
export function TimingCard({
  chart,
  summary,
  active,
}: {
  chart: TimingChart;
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const color = useCategoryColor()('Timing');
  const histogram = timingHistogram(summary.windows[active].rows, chart.timing);
  const enough = histogram.total >= TIMING_MIN_SAMPLES;
  const p = (q: number) => formatPercentile(histogram.scale, timingPercentile(histogram, q));
  const peak = Math.max(...histogram.buckets.map((b) => b.count), 1);
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{chart.title}</p>
          <p className="text-xs text-slate-400">
            {histogram.total.toLocaleString()} {histogram.total === 1 ? 'timing' : 'timings'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {enough ? p(0.75) : '–'}
          </p>
          <p className="text-xs text-slate-400">p75</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {chart.blurb}
      </p>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {enough
          ? `Median ${p(0.5)} · p95 ${p(0.95)}`
          : `Fewer than ${TIMING_MIN_SAMPLES} timings in this window, too few to read a percentile.`}
      </p>
      <div className="mt-auto pt-4">
        <div
          role="img"
          aria-label={`${chart.title} timings by bucket: ${histogram.buckets
            .filter((b) => b.count > 0)
            .map((b) => `${bucketLabel(histogram.scale, b.bucket)}: ${b.count}`)
            .join(', ')}`}
          className="flex h-16 items-end gap-1"
        >
          {histogram.buckets.map(({ bucket, count }) => (
            <div
              key={bucket.token}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${count === 0 ? 2 : Math.max(6, (count / peak) * 100)}%`,
                backgroundColor: color,
                opacity: count === 0 ? 0.15 : 0.85,
              }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-slate-400">
          <span>{formatTiming(histogram.scale, 0)}</span>
          <span>{bucketLabel(histogram.scale, histogram.buckets.at(-1)!.bucket)}</span>
        </div>
        {summary.daily ? (
          <P75Line values={dailyP75(summary.daily, chart.timing)} color={color} />
        ) : null}
      </div>
    </div>
  );
}

// Each day's p75 over the 30 days, a gap on a day with too few timings to read: a line through the
// days that have one, never a made-up value between them.
function P75Line({ values, color }: { values: (number | null)[]; color: string }) {
  const known = values.filter((v): v is number => v !== null);
  if (known.length < 2) return null;
  const max = Math.max(...known);
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * 100;
  const y = (v: number) => 95 - (v / max) * 85;
  const runs: string[] = [];
  let run: string[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (run.length > 1) runs.push(run.join(' '));
      run = [];
    } else run.push(`${x(i)},${y(v)}`);
  });
  if (run.length > 1) runs.push(run.join(' '));
  return (
    <div className="mt-3">
      <p className="text-[11px] text-slate-400">Daily p75, last 30 days</p>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-10 w-full" aria-hidden>
        {runs.map((points) => (
          <polyline
            key={points}
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}
