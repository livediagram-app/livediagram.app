'use client';

import { TIER_NAMES, type SubscriptionSummary } from '@liveworkspace/subscription';
import {
  ProBadge,
  tierPriceLine,
  useBilling,
  useSubscription,
  useUpgrade,
} from '@liveworkspace/subscription-ui';
import { Button, Spinner } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { ErrorNote } from '../error-note';
import { BackOnFree } from './BackOnFree';
import { cancellingBody, cancellingTitle, FREE_LINE, paidLine, pastDueBody } from './copy';
import { CellFallback, CellSkeleton } from './states';
import { usePortal } from './usePortal';

// A callout's words beside its button, which drops under them where the cell is narrow.
const BANNER_ROW = 'flex flex-wrap items-center gap-x-3 gap-y-2';

/** The banner over a subscription that needs the person: a failed renewal, or a cancel still running out. */
export function BillingBanner({
  summary,
  onPortal,
  busy,
}: {
  summary: SubscriptionSummary;
  onPortal: () => void;
  busy: boolean;
}) {
  if (summary.state === 'past_due') {
    return (
      <Callout
        tone="warning"
        size="md"
        role="status"
        title="This Month’s Payment Didn’t Go Through"
      >
        <div className={BANNER_ROW}>
          <span className="min-w-0 flex-1 basis-56">{pastDueBody(summary)}</span>
          <Button
            size="xs"
            className="relative touch-target shrink-0"
            busy={busy}
            onClick={onPortal}
          >
            {busy ? <Spinner /> : null}
            Update Payment
          </Button>
        </div>
      </Callout>
    );
  }
  if (summary.state === 'cancelling') {
    return (
      <Callout tone="info" size="md" role="status" title={cancellingTitle(summary)}>
        <div className={BANNER_ROW}>
          <span className="min-w-0 flex-1 basis-56">{cancellingBody(summary)}</span>
          <Button
            variant="secondary"
            size="xs"
            className="relative touch-target shrink-0"
            busy={busy}
            onClick={onPortal}
          >
            {busy ? <Spinner /> : null}
            {`Keep ${TIER_NAMES[summary.tier]}`}
          </Button>
        </div>
      </Callout>
    );
  }
  return null;
}

/**
 * Your tier (subscription.md "Settings, Subscription"): its name, the Pro badge, what it costs in the currency it
 * was taken in and when it renews or ends, with Manage Billing; or, on Free, what Pro adds and Upgrade to Pro.
 */
export function SubscriptionTierCell() {
  const load = useSubscription();
  const upgrade = useUpgrade();
  const portal = usePortal();
  const billing = useBilling();
  if (load.status !== 'ready')
    return <CellFallback load={load} lead skeleton={<CellSkeleton card />} />;

  const { personal, prices } = load.me;
  const paid = personal.tier !== 'free';
  const busy = portal.opening === personal.owner;
  // The paid tier that ended lately, as the service says until the card that says so is dismissed in any browser.
  const lapsed = !paid && personal.endedAt !== undefined ? (personal.endedTier ?? null) : null;
  return (
    <div
      data-subscription-tier={personal.tier}
      data-subscription-state={personal.state ?? 'none'}
      // A paid tier's card is edged in the badge's ink, over the group card's own edge.
      className={`flex flex-col gap-4 rounded-xl px-4 py-4 ${
        paid ? 'ring-1 ring-slate-900 dark:ring-slate-200' : ''
      }`}
    >
      {paid ? (
        <BillingBanner
          summary={personal}
          busy={busy}
          onPortal={() => portal.open(personal.owner)}
        />
      ) : lapsed ? (
        <BackOnFree
          summary={personal}
          had={lapsed}
          onUpgrade={() => upgrade.openUpgrade({ owner: personal.owner })}
          onDismiss={() => billing?.dismissEnded(personal.owner)}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Just You · Your Personal Library
          </span>
          <span className="flex items-center gap-2.5">
            <span className="text-[22px] leading-tight font-bold text-slate-900 dark:text-slate-100">
              {TIER_NAMES[personal.tier]}
            </span>
            {paid ? <ProBadge form="solid" /> : null}
          </span>
          <span className="text-[13px] leading-normal text-slate-600 dark:text-slate-300">
            {paid ? paidLine(personal) : FREE_LINE}
          </span>
        </div>
        {paid ? (
          <Button
            variant="secondary"
            size="md"
            busy={busy}
            onClick={() => portal.open(personal.owner)}
          >
            {busy ? <Spinner /> : null}
            Manage Billing
          </Button>
        ) : (
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            {/* One leading button at a time: while the card above offers the way back, this one steps down. */}
            <Button
              variant={lapsed ? 'secondary' : 'primary'}
              size="md"
              onClick={() => upgrade.openUpgrade({ owner: personal.owner })}
            >
              Upgrade to Pro
            </Button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {tierPriceLine(prices, 'pro')}
            </span>
          </div>
        )}
      </div>
      {portal.error ? <ErrorNote>{portal.error}</ErrorNote> : null}
    </div>
  );
}
