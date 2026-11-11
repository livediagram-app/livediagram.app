'use client';

// The Runs today meter (docs/specs/026-plan/automations.md "Runs, limits and loops"): how many of the plan's daily
// runs are spent, as a thin bar and "142 of 1,000". Full, it turns amber and the screen says rules run again
// tomorrow. `stacked` is the phone's footer form: the bar across, the words after it.

import { meterWords } from './run-words';

export function RunsMeter({
  used,
  max,
  stacked = false,
}: {
  used: number;
  max: number;
  stacked?: boolean;
}) {
  const share = max > 0 ? Math.min(1, used / max) : 0;
  const full = used >= max;
  const words = meterWords(used, max);
  const bar = (
    <span
      role="meter"
      aria-label="Runs today"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(used, max)}
      aria-valuetext={`${words} runs today`}
      className={`inline-block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${stacked ? 'flex-1' : 'w-[120px]'}`}
    >
      <span
        className={`block h-full rounded-full ${full ? 'bg-amber-500' : 'bg-brand-600 dark:bg-brand-400'}`}
        style={{ width: `${share * 100}%` }}
      />
    </span>
  );
  if (stacked)
    return (
      <div className="flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
        {bar}
        <span aria-hidden>{words} runs today</span>
      </div>
    );
  return (
    <div className="flex items-center gap-2 py-2 text-[12px] text-slate-500 dark:text-slate-400">
      <span aria-hidden>Runs today</span>
      {bar}
      <span aria-hidden className="font-medium tabular-nums text-slate-700 dark:text-slate-200">
        {words}
      </span>
    </div>
  );
}
