import type { Rising } from './metric-series';

// The arrow beside a number saying which way it moved against the span just
// before the window (spec/22). Green when that is good news, red when bad,
// yellow when neither: a metric that could read either way, or no change.
//
// The change shows as a percentage (a number that doubled reads +100% whether
// it went 1 to 2 or 500 to 1,000), or as a plain difference when there was
// nothing before to be a percentage of.

const TONES = {
  good: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  bad: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  neutral: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
};

// A change under half a percent still moved, so it reads "<1%", not "0%".
const percent = (ratio: number) => {
  const pct = Math.round(ratio * 100);
  return pct === 0 ? '<1%' : `${pct.toLocaleString()}%`;
};

export function TrendBadge({
  now,
  before,
  rising = 'good',
  against,
}: {
  now: number;
  before: number;
  rising?: Rising;
  against: string; // "the 7 days before", for the tooltip
}) {
  const delta = now - before;
  const flat = delta === 0;
  const up = delta > 0;
  const tone =
    flat || rising === 'neutral'
      ? TONES.neutral
      : up === (rising === 'good')
        ? TONES.good
        : TONES.bad;
  const arrow = flat ? '→' : up ? '▲' : '▼';
  const amount = flat
    ? 'flat'
    : before === 0
      ? Math.abs(delta).toLocaleString()
      : percent(Math.abs(delta) / before);
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${tone}`}
      title={`Against ${against}: ${before.toLocaleString()}`}
    >
      {arrow} {amount}
      <span className="sr-only"> against {against}</span>
    </span>
  );
}
