'use client';

import type { TelemetryDaily, TelemetryWindowKey } from '@livediagram/api-schema';
import { TrendChart } from './TrendChart';
import { WINDOW_META, windowHighlightFrom, windowLabel } from './windows';

// The global timeframe control (spec/22), shown above the view tabs and
// shared by all of them. It merges what used to be three separate pieces
// — the Today / Last 7 / Last month toggle, the per-window stat cards,
// and the standalone daily sparkline — into one component. The three
// cards ARE the filter: clicking one selects that window (driving every
// tab below) and highlights the matching span of the 30-day trend line
// directly underneath, so the reader controls the filter and sees the
// line in one place.

const BRAND = 'var(--color-brand-500)';

export function WindowPanel({
  totals,
  daily,
  active,
  onSelect,
}: {
  totals: Record<TelemetryWindowKey, number>;
  daily: TelemetryDaily | undefined;
  active: TelemetryWindowKey;
  onSelect: (key: TelemetryWindowKey) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="grid gap-3 sm:grid-cols-3">
        {WINDOW_META.map((w) => {
          const isActive = active === w.key;
          return (
            <button
              key={w.key}
              type="button"
              onClick={() => onSelect(w.key)}
              aria-pressed={isActive}
              className={
                'cursor-pointer rounded-xl border p-4 text-left transition ' +
                (isActive
                  ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-500/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800')
              }
            >
              <span className="flex items-center justify-between">
                <span
                  className={
                    'text-[10px] font-semibold uppercase tracking-wide ' +
                    (isActive ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400')
                  }
                >
                  {w.label}
                </span>
                {isActive ? (
                  <span aria-hidden className="h-2 w-2 rounded-full bg-brand-500" />
                ) : null}
              </span>
              <span className="mt-1 block text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {totals[w.key].toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {daily ? (
        <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Daily volume — last 30 days
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {windowLabel(active)} highlighted
            </p>
          </div>
          <div className="mt-4">
            <TrendChart
              days={daily.days}
              values={daily.totals}
              color={BRAND}
              highlightFromIndex={windowHighlightFrom(daily, active)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
