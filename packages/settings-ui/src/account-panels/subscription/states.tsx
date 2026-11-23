'use client';

import type { ReactNode } from 'react';
import { useRefreshSubscription, type SubscriptionLoad } from '@liveworkspace/subscription-ui';
import { ErrorNote } from '../error-note';

// What a Subscription cell shows while there is no subscription to draw: the service still answering, nobody signed
// in, or no answer at all. Each is drawn, never left blank.

const PULSE = 'animate-pulse rounded bg-slate-100 motion-reduce:animate-none dark:bg-slate-700/60';

/** Grey lines the shape of what is coming: `rows` list rows, or the tier card when `card`. */
export function CellSkeleton({ rows = 0, card = false }: { rows?: number; card?: boolean }) {
  return (
    <div aria-busy aria-label="Loading your subscription" className="flex flex-col gap-4 px-4 py-4">
      {card ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-1 flex-col gap-2">
            <span className={`h-3 w-40 ${PULSE}`} />
            <span className={`h-6 w-24 ${PULSE}`} />
            <span className={`h-3 w-64 max-w-full ${PULSE}`} />
          </div>
          <span className={`h-9 w-32 rounded-md ${PULSE}`} />
        </div>
      ) : null}
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <span className={`size-6 shrink-0 rounded-md ${PULSE}`} />
          <span className={`h-3 flex-1 ${PULSE}`} />
          <span className={`h-3 w-24 ${PULSE}`} />
        </div>
      ))}
    </div>
  );
}

/** A quiet line in place of a cell's content. */
function Quiet({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 py-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      {children}
    </p>
  );
}

/**
 * What to draw in place of a cell when the subscription is not `ready`, or null when it is. `lead`: the cell that
 * leads the category (the tier card) says the most, with the way to try again; the cells under it stay short so one
 * failure is not said three times.
 */
export function CellFallback({
  load,
  lead = false,
  skeleton,
}: {
  load: SubscriptionLoad;
  lead?: boolean;
  skeleton: ReactNode;
}) {
  const refresh = useRefreshSubscription();
  if (load.status === 'ready') return null;
  if (load.status === 'loading') return <>{skeleton}</>;
  if (load.status === 'signed_out')
    return (
      <Quiet>
        {lead
          ? 'Sign in to see your subscription. A subscription belongs to an account, so it follows you to every device.'
          : 'Shown once you are signed in.'}
      </Quiet>
    );
  if (!lead) return <Quiet>Not loaded.</Quiet>;
  return (
    <div className="px-4 pb-4">
      <ErrorNote action={{ label: 'Try Again', onSelect: () => void refresh() }}>
        Couldn’t load your subscription. Check your connection and try again.
      </ErrorNote>
    </div>
  );
}
