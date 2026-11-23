'use client';

import { useEffect, useState } from 'react';
import { ComparisonGrid, useSubscription, type AccountKnown } from '@liveworkspace/subscription-ui';
import { accountApi } from '@/lib/account-api';
import { signInHref } from '@/lib/accounts';

/** Whether a signed-in person has their own AI key set (Settings › AI), read once: null for a visitor, or when the
 *  account API cannot say, so the cell stays quiet rather than guess. */
function useOwnAiKey(account: AccountKnown): boolean | 'loading' | null {
  const [key, setKey] = useState<boolean | 'loading' | null>('loading');
  useEffect(() => {
    if (account !== 'in') return;
    let live = true;
    void accountApi<{ key: unknown }>('/ai-key').then((result) => {
      if (live) setKey(result.ok ? result.data.key != null : null);
    });
    return () => {
      live = false;
    };
  }, [account]);
  return account === 'in' ? key : null;
}

/**
 * Every limit, side by side (subscription.md "The pricing page"): the same comparison the upgrade dialog draws, from
 * the same rows. Signed in, a Your Usage Now column from the personal library; signed out, the way to sign in and see
 * it.
 */
export function PricingComparison({ account }: { account: AccountKnown }) {
  const load = useSubscription();
  const ownAiKey = useOwnAiKey(account);
  // The column is a signed-in person's alone, so a visitor's comparison never grows one and drops it again.
  const usage =
    account !== 'in'
      ? null
      : load.status === 'ready'
        ? load.me.personal
        : load.status === 'loading'
          ? 'loading'
          : null;
  return (
    <section
      id="compare"
      aria-labelledby="compare-title"
      className="flex scroll-mt-20 flex-col gap-2"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-3">
        <div className="max-w-2xl">
          <h2
            id="compare-title"
            className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white"
          >
            Every Limit, Side by Side
          </h2>
          <p className="mt-2 text-base leading-relaxed text-pretty text-slate-600 dark:text-slate-300">
            What each tier includes. The limits are the same in every app.
          </p>
        </div>
        {account === 'out' ? (
          <a
            href={signInHref('/pricing')}
            className="relative touch-target-y text-[13px] font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900 hover:decoration-slate-500 dark:text-slate-200 dark:decoration-slate-600 dark:hover:text-white dark:hover:decoration-slate-400"
          >
            Sign In to See Your Own Usage
          </a>
        ) : account === 'in' ? (
          <span className="text-[13px] text-slate-500 dark:text-slate-400">
            Comparing your personal usage
          </span>
        ) : null}
      </div>
      <ComparisonGrid
        label="What each tier allows"
        usage={usage}
        usageHeading="Your Usage Now"
        ownAiKey={ownAiKey}
        highlight="pro"
      />
      <p className="pt-2 text-xs leading-normal text-slate-500 dark:text-slate-400">
        Nothing is deleted when you reach a limit, on any tier. Everything on Free stays free.
      </p>
    </section>
  );
}
