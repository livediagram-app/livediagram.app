'use client';

import { TIER_NAMES, type MockPortal, type MockPortalRequest } from '@liveworkspace/subscription';
import { ProBadge } from '@liveworkspace/subscription-ui';
import { Button, Spinner } from '@liveworkspace/ui';
import { BillingCard } from './BillingShell';
import { cancelNote, monthly, seatPrice, STATE_LABEL, stateSentence } from './billing-copy';

const CHIP: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  cancelling: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  past_due: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300',
  ended: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
};

/** The current subscription: its tier and state, what it costs, a team's seats, and Cancel or Resume. */
export function BillingSubscription({
  portal,
  acting,
  onAct,
}: {
  portal: MockPortal;
  acting: MockPortalRequest['action'] | null;
  onAct: (request: MockPortalRequest) => void;
}) {
  const { subscription, members } = portal;
  const state = subscription.state ?? 'ended';
  const paid = subscription.tier !== 'free' && state !== 'ended';
  const cost = monthly(subscription);
  const seat = seatPrice(subscription);
  return (
    <BillingCard>
      <div
        data-billing-state={state}
        className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 p-6 sm:p-8"
      >
        <div className="flex min-w-0 flex-[1_1_18rem] flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Current Subscription
          </h2>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {paid ? TIER_NAMES[subscription.tier] : TIER_NAMES.free}
            </span>
            {paid ? <ProBadge form="solid" label="Pro" tooltip={false} /> : null}
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CHIP[state] ?? CHIP.ended}`}
            >
              {STATE_LABEL[state]}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {stateSentence(subscription)}
          </p>
        </div>
        {paid && cost ? (
          <p className="text-xl font-bold text-slate-900 tabular-nums dark:text-white">{cost}</p>
        ) : null}
      </div>
      {paid && members !== null ? (
        <dl className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-slate-100 px-6 py-4 text-sm sm:px-8 dark:border-slate-800">
          <dt className="font-medium text-slate-900 dark:text-white">Seats</dt>
          <dd className="text-slate-600 tabular-nums dark:text-slate-300">
            {subscription.seats}
            {seat ? ` × ${seat} a member` : ''} · {members} joined{' '}
            {members === 1 ? 'member' : 'members'}
          </dd>
        </dl>
      ) : null}
      {paid ? (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-slate-100 px-6 py-4 sm:px-8 dark:border-slate-800">
          <p className="min-w-0 flex-[1_1_16rem] text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {cancelNote(subscription)}
          </p>
          {state === 'cancelling' ? (
            <Button
              size="md"
              className="min-h-11"
              busy={acting !== null}
              onClick={() => onAct({ action: 'resume' })}
            >
              {acting === 'resume' ? <Spinner /> : null}
              Resume
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="md"
              className="min-h-11"
              busy={acting !== null}
              onClick={() => onAct({ action: 'cancel' })}
            >
              {acting === 'cancel' ? <Spinner /> : null}
              Cancel Subscription
            </Button>
          )}
        </div>
      ) : null}
    </BillingCard>
  );
}
