'use client';

import { useId } from 'react';
import { TIER_NAMES, type PaidTier, type SubscriptionSummary } from '@liveworkspace/subscription';
import { Button } from '@liveworkspace/ui';
import { lapsedChanges } from './copy';

const CHIP = {
  quiet: 'bg-slate-200/70 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  waiting: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300',
} as const;

/**
 * "You're Back on Free" (subscription.md "You're Back on Free"): what a person sees the first time they open
 * Subscription after their paid tier ended. It says nothing was deleted, lists what works differently now with where
 * each stands, and offers the way back. It stays until dismissed, then is not said again.
 */
export function BackOnFree({
  summary,
  had,
  onUpgrade,
  onDismiss,
}: {
  summary: SubscriptionSummary;
  /** The paid tier that ended. */
  had: PaidTier;
  onUpgrade: () => void;
  onDismiss: () => void;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      data-back-on-free={had}
      className="flex flex-col gap-3.5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
    >
      <div className="flex flex-col gap-1">
        <h4 id={titleId} className="text-base font-bold text-slate-900 dark:text-slate-100">
          You’re Back on Free
        </h4>
        <p className="text-[13px] leading-normal text-slate-600 dark:text-slate-300">
          {TIER_NAMES[had]} has ended. Nothing was deleted. Here is what works differently now.
        </p>
      </div>
      <ul className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {lapsedChanges(summary, had).map((change) => (
          <li
            key={change.key}
            data-lapsed-change={change.key}
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 px-3.5 py-2.5 first:border-t-0 dark:border-slate-800"
          >
            <div className="flex min-w-0 flex-[1_1_15rem] flex-col gap-0.5">
              <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                {change.name}
              </span>
              <span className="text-xs leading-normal text-slate-600 dark:text-slate-300">
                {change.what}
              </span>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                change.waiting ? CHIP.waiting : CHIP.quiet
              }`}
            >
              {change.state}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onUpgrade}>
          Go Pro Again
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </section>
  );
}
