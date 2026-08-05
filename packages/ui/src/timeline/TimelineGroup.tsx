'use client';

// One day on the feed: the rail dot, the connecting line, the date
// label, and the day's bubbles (spec/138 §2).

import type { ReactNode } from 'react';

export function TimelineGroup({
  label,
  year,
  isToday,
  isFuture,
  dateKey,
  pulse,
  children,
}: {
  label: string;
  year: string;
  isToday: boolean;
  isFuture: boolean;
  dateKey: string;
  // Set briefly after the reader picks this date in the mini calendar.
  pulse?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="flex gap-3 md:gap-4"
      // The mini calendar finds a day by querying this attribute rather
      // than holding refs to every group — the groups it scrolls to are
      // usually not mounted yet when the calendar renders.
      data-timeline-day={dateKey}
    >
      <div className="flex flex-shrink-0 flex-col items-center">
        <div
          className={`mt-3 h-2.5 w-2.5 flex-shrink-0 rounded-full ${
            isToday
              ? 'bg-brand-500 ring-2 ring-brand-500/30'
              : isFuture
                ? 'bg-violet-400/60'
                : 'bg-slate-300 dark:bg-slate-600'
          }`}
        />
        <div
          className={`w-px flex-1 ${
            isFuture ? 'bg-violet-400/25' : 'bg-slate-200 dark:bg-slate-700'
          }`}
        />
      </div>

      <div className="min-w-0 flex-1 pb-4">
        <div className="mb-2 flex items-baseline gap-2 pt-1">
          {isToday && (
            <span className="rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Today
            </span>
          )}
          {isFuture && (
            <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
              Upcoming
            </span>
          )}
          <p
            className={`whitespace-nowrap text-sm font-semibold ${
              isToday ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
            } ${pulse ? 'animate-pulse' : ''}`}
          >
            {label}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">{year}</p>
        </div>
        <div
          className={`space-y-1.5 rounded-lg transition-shadow duration-700 ${
            // Box-shadow only, never a transform. Transforming the group
            // promotes it to its own compositing layer, and tearing that
            // layer down when the animation ends makes every bubble
            // inside briefly vanish — which reads as a rendering bug.
            pulse ? 'shadow-[0_0_0_3px_var(--color-brand-300)]' : ''
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
