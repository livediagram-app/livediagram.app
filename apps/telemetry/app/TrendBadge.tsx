import type { Rising } from './metric-series';

// The arrow beside a number saying which way it moved against the span just
// before the window (spec/22). Green when that is good news, red when bad,
// yellow when neither: a metric that could read either way, or no change.
//
// Counts show the change as a percentage (a number that doubled reads +100%
// whether it went 1 to 2 or 500 to 1,000), or as a plain difference when there
// was nothing before to be a percentage of. Rates and averages (the Pages
// insights) show the difference in their own unit.

const TONES = {
  good: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  bad: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  neutral: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
};

export function TrendBadge({
  now,
  before,
  rising = 'good',
  against,
  difference,
}: {
  now: number;
  before: number;
  rising?: Rising;
  against: string; // "the 7 days before", for the tooltip
  // Show the change in the value's own unit instead of as a percentage, with
  // this formatter and this threshold below which it counts as flat.
  difference?: { format: (n: number) => string; flatBelow: number };
}) {
  const delta = now - before;
  const flat = difference ? Math.abs(delta) < difference.flatBelow : delta === 0;
  const up = delta > 0;
  const tone = flat
    ? TONES.neutral
    : rising === 'neutral'
      ? TONES.neutral
      : up === (rising === 'good')
        ? TONES.good
        : TONES.bad;
  const arrow = flat ? '→' : up ? '▲' : '▼';
  const format = difference?.format ?? ((n: number) => n.toLocaleString());
  const amount = flat
    ? 'flat'
    : difference || before === 0
      ? format(Math.abs(delta))
      : `${Math.round((Math.abs(delta) / before) * 100).toLocaleString()}%`;
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${tone}`}
      title={`Against ${against}: ${format(before)}`}
    >
      {arrow} {amount}
      <span className="sr-only"> against {against}</span>
    </span>
  );
}
