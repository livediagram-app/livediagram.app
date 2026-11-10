'use client';

// The Timeline's states around the feed: Show More, the loading skeleton and the failed read.

import { Button } from '@liveworkspace/ui';
import { MoreFailed } from '../explorer/MoreFailed';
import { CARD_GRID } from '../ui/classes';

export const QUIET_BUTTON =
  'rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';

export function ShowMore({
  loading,
  failed,
  onClick,
}: {
  loading?: boolean;
  failed?: boolean;
  onClick?: () => void;
}) {
  if (failed && onClick) return <MoreFailed onRetry={onClick} loading={loading ?? false} />;
  return (
    <div className="pt-2 text-center">
      <Button variant="none" busy={loading} onClick={onClick} className={QUIET_BUTTON}>
        {loading ? 'Loading…' : 'Show More'}
      </Button>
    </div>
  );
}

// A skeleton rather than the empty state: "nothing has happened" while loading is usually false.
export function SkeletonFeed() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      {[0, 1].map((row) => (
        <div key={row} className="flex gap-4">
          <div className="mt-3 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            <div className={CARD_GRID}>
              {[0, 1, 2].map((card) => (
                <div key={card} className="h-64 rounded-xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** "We couldn't read the feed": never the empty state, which would tell someone with a history that they have none. */
export function TimelineErrorState({
  onRetry,
  title = 'Couldn\u2019t load your Timeline',
}: {
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700"
    >
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Your history is safe. Check your connection and try again.
      </p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className={`mt-3 ${QUIET_BUTTON}`}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
