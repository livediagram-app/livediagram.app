'use client';

import { useState, type ReactNode } from 'react';
import {
  formatPrice,
  TIER_NAMES,
  type OwnerScope,
  type PaidTier,
  type SubscriptionSummary,
  type Tier,
} from '@liveworkspace/subscription';
import {
  billingErrorMessage,
  formatDay,
  pricePeriod,
  ProBadge,
  tierPrice,
  useBilling,
  usePrices,
  useRefreshSubscription,
  useSubscription,
  useUpgrade,
  type AccountKnown,
} from '@liveworkspace/subscription-ui';
import { Button, buttonClassName, ButtonContent, Spinner } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { signInHref, signUpHref } from '@/lib/accounts';

const PRICING_PATH = '/pricing';

const CARD =
  'flex min-w-0 flex-[1_1_17.5rem] flex-col gap-3.5 rounded-2xl bg-white p-6 dark:bg-slate-900';
// The tier on offer is edged in the badge's ink; a pixel less padding keeps the three cards' contents level.
const EDGE: Record<Tier, string> = {
  free: 'border border-slate-200 dark:border-slate-700',
  pro: 'border-2 border-slate-900 p-[23px] dark:border-white',
  team: 'border border-slate-200 dark:border-slate-700',
};

const PITCH: Record<Tier, string> = {
  free: 'Everything you need to plan, draw, write and meet together.',
  pro: 'Higher limits for your personal library, one plan across all of our apps.',
  team: 'The highest limits, pooled across everyone in a team’s library.',
};

/**
 * The three tier cards (subscription.md "The pricing page"). Each price is the service's, in the visitor's currency,
 * written for their locale. Signed in, Get Pro starts the checkout and Get Pro for Teams opens the upgrade dialog on
 * A Team (a team has to be chosen); signed out, both go to sign in and come back here. The page as built is the
 * signed-out one, so its links work before any script runs.
 */
export function PricingTiers({ account }: { account: AccountKnown }) {
  const prices = usePrices();
  const load = useSubscription();
  const billing = useBilling();
  const upgrade = useUpgrade();
  const [busy, setBusy] = useState<OwnerScope | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useRefreshSubscription();
  const me = load.status === 'ready' ? load.me : null;
  // The page as built, and for anyone not known to be signed in: links to sign in, which come back here. Only a
  // signed-in person's page turns them into the buttons that start a checkout.
  const signedOut = account !== 'in' || load.status === 'signed_out';
  const unread = account === 'in' && load.status === 'error';
  const yours: Tier | null = me ? me.personal.tier : null;
  const signIn = signInHref(PRICING_PATH);

  const leave = (owner: OwnerScope, how: 'checkout' | 'portal') => {
    if (!billing) return;
    setBusy(owner);
    setError(null);
    billing[how](owner).catch((failure: unknown) => {
      setBusy(null);
      setError(billingErrorMessage(failure));
    });
  };

  const price = (tier: PaidTier | 'free'): ReactNode =>
    prices ? (
      <span className="text-[34px] leading-none font-bold text-slate-900 tabular-nums dark:text-white">
        {tier === 'free' ? formatPrice(0, prices.currency) : tierPrice(prices, tier)}
      </span>
    ) : (
      <span
        aria-hidden
        className="h-[34px] w-14 animate-pulse rounded-md bg-slate-100 motion-reduce:animate-none dark:bg-slate-800"
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-5">
        <section aria-labelledby="tier-free" className={`${CARD} ${EDGE.free}`}>
          <TierHeading id="tier-free" tier="free" yours={yours === 'free'} />
          <PriceLine price={price('free')} period="always" />
          <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            {PITCH.free}
          </p>
          <span className="mt-auto pt-1">
            {signedOut ? (
              <a
                href={signUpHref(PRICING_PATH)}
                className={buttonClassName({
                  variant: 'secondary',
                  size: 'md',
                  className: 'min-h-11 w-full',
                })}
              >
                <ButtonContent>Start Free</ButtonContent>
              </a>
            ) : (
              <a
                href="#compare"
                className={buttonClassName({
                  variant: 'secondary',
                  size: 'md',
                  className: 'min-h-11 w-full',
                })}
              >
                <ButtonContent>Compare the Limits</ButtonContent>
              </a>
            )}
          </span>
        </section>

        <section aria-labelledby="tier-pro" className={`${CARD} ${EDGE.pro}`}>
          <TierHeading id="tier-pro" tier="pro" yours={yours === 'pro'} />
          <PriceLine price={price('pro')} period={pricePeriod('pro')} />
          <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            {PITCH.pro}
          </p>
          <span className="mt-auto pt-1">
            {signedOut ? (
              <a
                href={signIn}
                className={buttonClassName({ size: 'md', className: 'min-h-11 w-full' })}
              >
                <ButtonContent>Get Pro</ButtonContent>
              </a>
            ) : me && me.personal.tier !== 'free' ? (
              <Button
                variant="secondary"
                size="md"
                className="min-h-11 w-full"
                busy={busy === me.personal.owner}
                onClick={() => leave(me.personal.owner, 'portal')}
              >
                {busy === me.personal.owner ? <Spinner /> : null}
                Manage Billing
              </Button>
            ) : (
              <Button
                size="md"
                className="min-h-11 w-full"
                disabled={!me}
                busy={!!me && busy === me.personal.owner}
                onClick={() => me && leave(me.personal.owner, 'checkout')}
              >
                {me && busy === me.personal.owner ? <Spinner /> : null}
                Get Pro
              </Button>
            )}
          </span>
        </section>

        <section aria-labelledby="tier-team" className={`${CARD} ${EDGE.team}`}>
          <TierHeading id="tier-team" tier="team" yours={false} />
          <PriceLine price={price('team')} period={pricePeriod('team')} />
          <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            {PITCH.team}
          </p>
          <span className="mt-auto pt-1">
            {signedOut ? (
              <a
                href={signIn}
                className={buttonClassName({
                  variant: 'secondary',
                  size: 'md',
                  className: 'min-h-11 w-full',
                })}
              >
                <ButtonContent>Get Pro for Teams</ButtonContent>
              </a>
            ) : (
              <Button
                variant="secondary"
                size="md"
                className="min-h-11 w-full"
                disabled={!me}
                aria-haspopup="dialog"
                onClick={() => upgrade.openUpgrade({ subscribeFor: 'team' })}
              >
                Get Pro for Teams
              </Button>
            )}
          </span>
        </section>
      </div>
      {error ? (
        <Callout tone="error" role="alert" size="md">
          {error}
        </Callout>
      ) : unread ? (
        <Callout
          tone="error"
          role="alert"
          size="md"
          action={{ label: 'Try Again', onSelect: () => void refresh() }}
        >
          Couldn’t load your subscription, so the buttons above are waiting. Check your connection
          and try again.
        </Callout>
      ) : null}
      <Footnote summary={me && me.personal.tier !== 'free' ? me.personal : null} />
    </div>
  );
}

// The paid cards say who each Pro is for in the heading itself (subscription.md "The pricing page").
const CARD_FOR = { pro: '(for Individuals)', team: '(for Teams)' } as const;

function TierHeading({ id, tier, yours }: { id: string; tier: Tier; yours: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 id={id} className="text-lg font-bold text-slate-900 dark:text-white">
        {tier === 'free' ? (
          TIER_NAMES.free
        ) : (
          <>
            Pro{' '}
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              {CARD_FOR[tier]}
            </span>
          </>
        )}
      </h2>
      {tier !== 'free' ? <ProBadge form="solid" size="sm" label="Pro" tooltip={false} /> : null}
      {yours ? (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          Your Tier
        </span>
      ) : null}
    </div>
  );
}

/**
 * The line under the cards. For a visitor, and on Free, how the price works; for a subscriber, where their own
 * subscription stands (when it renews or ends, in amber while a renewal has failed). One line either way, so the
 * page does not move when the subscription is read.
 */
function Footnote({ summary }: { summary: SubscriptionSummary | null }) {
  const words = summary ? standingSentence(summary) : null;
  if (!summary || !words)
    return (
      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Monthly, with no yearly commitment. Cancel any time in Manage Billing.
      </p>
    );
  return (
    <p
      data-standing={summary.state ?? 'none'}
      className={`text-center text-xs ${
        summary.state === 'past_due'
          ? 'font-medium text-amber-800 dark:text-amber-300'
          : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      {words}
    </p>
  );
}

/** A subscriber's own standing as one sentence, with where to act on it. Null where the service named no day. */
export function standingSentence(summary: SubscriptionSummary): string | null {
  const name = TIER_NAMES[summary.tier];
  if (summary.state === 'past_due' && summary.graceEnds !== null)
    return `Your ${name} payment failed. It stays on until ${formatDay(summary.graceEnds)}: update your payment in Manage Billing.`;
  if (summary.periodEnd === null) return null;
  if (summary.state === 'cancelling')
    return `Your ${name} ends on ${formatDay(summary.periodEnd)}. Keep it in Manage Billing.`;
  if (summary.state === 'active')
    return `Your ${name} renews on ${formatDay(summary.periodEnd)}. Cancel any time in Manage Billing.`;
  return null;
}

function PriceLine({ price, period }: { price: ReactNode; period: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
      {price}
      <span className="text-[13px] text-slate-500 dark:text-slate-400">{period}</span>
    </div>
  );
}
