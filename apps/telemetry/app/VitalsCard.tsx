'use client';

import type { TelemetrySummary, TelemetryWindowKey, WebVital } from '@livediagram/api-schema';
import type { TimingChart } from './catalogue/timings';
import {
  formatPercentile,
  TIMING_MIN_SAMPLES,
  timingHistogram,
  timingPercentile,
  vitalRating,
  type VitalRating,
} from './timing-stats';

// One app's Core Web Vitals (docs/specs/017-telemetry/timing-telemetry.md): a row per vital with its
// estimated p75 and a rating against Google's thresholds, the word always shown beside the colour.
const RATING_CLASS: Record<VitalRating, string> = {
  Good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  'Needs Work': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  Poor: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

// What each vital measures, in a few words, under its name.
const VITAL_HINT: Record<WebVital, string> = {
  Lcp: 'Main content showing',
  Inp: 'Answering a click or key',
  Cls: 'Layout jumping',
};

export function VitalsCard({
  app,
  charts,
  summary,
  active,
}: {
  app: string;
  charts: readonly TimingChart[];
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const rows = summary.windows[active].rows;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{app}</p>
      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {charts.map((chart) => {
          const histogram = timingHistogram(rows, chart.timing);
          const p75 = timingPercentile(histogram, 0.75);
          const enough = histogram.total >= TIMING_MIN_SAMPLES && p75 !== null;
          const rating = enough && chart.vital ? vitalRating(chart.vital, p75) : null;
          return (
            <li key={chart.timing} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-slate-800 dark:text-slate-200">
                  {chart.title.split(' · ')[0]}
                </p>
                <p className="text-xs text-slate-400">
                  {chart.vital ? `${VITAL_HINT[chart.vital]} · ` : ''}
                  {histogram.total.toLocaleString()} {histogram.total === 1 ? 'page' : 'pages'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {enough ? formatPercentile(histogram.scale, p75) : 'Too few'}
                </span>
                {rating ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${RATING_CLASS[rating]}`}
                  >
                    {rating}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
