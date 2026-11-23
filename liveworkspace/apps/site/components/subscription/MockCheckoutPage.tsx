'use client';

import { useEffect, useState } from 'react';
import { lucideLock } from '@liveworkspace/icons/lucide';
import {
  formatPrice,
  parseOwnerScope,
  TIER_NAMES,
  type MockCheckout,
  type MockCheckoutAction,
} from '@liveworkspace/subscription';
import { ProBadge } from '@liveworkspace/subscription-ui';
import { Button, buttonClassName, ButtonContent, lucideGlyph, Spinner } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { useLocationSearch } from '@/lib/location-search';
import { BillingCard, BillingLoading, BillingMessage, BillingShell } from './BillingShell';
import { isGone, leaveTo, mockBilling, sessionFrom } from './mock-client';

const LockIcon = lucideGlyph(lucideLock, 12);

type Load =
  | { kind: 'loading' }
  | { kind: 'gone' }
  | { kind: 'error' }
  | { kind: 'ready'; checkout: MockCheckout };

/**
 * The mock checkout (subscription.md "Billing", Subscribe): what is being bought, who for, the seats and the price a
 * month, then Pay and Subscribe or Cancel. It takes no card: paying switches the subscription on for a month and
 * sends the browser back where it came from, so the whole flow can be tried before Stripe is wired in.
 */
export function MockCheckoutPage() {
  const session = sessionFrom(useLocationSearch());
  const [loaded, setLoaded] = useState<Load>({ kind: 'loading' });
  const [acting, setActing] = useState<MockCheckoutAction | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!session) return;
    let live = true;
    mockBilling.mockCheckout(session).then(
      (checkout) => live && setLoaded({ kind: 'ready', checkout }),
      (error: unknown) => live && setLoaded({ kind: isGone(error) ? 'gone' : 'error' }),
    );
    return () => {
      live = false;
    };
  }, [session]);

  // No session in the address: nothing to pay for.
  const load: Load = session ? loaded : { kind: 'gone' };

  const act = (action: MockCheckoutAction) => {
    if (!session) return;
    setActing(action);
    setFailed(false);
    mockBilling.actOnMockCheckout(session, action).then(
      // The page stays busy until the browser has left.
      ({ url }) => leaveTo(url),
      () => {
        setActing(null);
        setFailed(true);
      },
    );
  };

  return (
    <BillingShell>
      {load.kind === 'loading' ? (
        <BillingLoading label="Opening your checkout…" />
      ) : load.kind === 'gone' ? (
        <BillingMessage
          title="This Checkout Has Closed"
          action={
            <a href="/pricing" className={buttonClassName({ size: 'md' })}>
              <ButtonContent>See Pricing</ButtonContent>
            </a>
          }
        >
          A checkout link works once, and for a short while. Start again from Upgrade to Pro, in the
          app or on the pricing page.
        </BillingMessage>
      ) : load.kind === 'error' ? (
        <BillingMessage
          title="Couldn’t Open Your Checkout"
          action={
            <Button size="md" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          }
        >
          Check your connection and try again. Nothing was charged.
        </BillingMessage>
      ) : (
        <CheckoutCard
          checkout={load.checkout}
          acting={acting}
          failed={failed}
          onPay={() => act('pay')}
          onCancel={() => act('cancel')}
        />
      )}
    </BillingShell>
  );
}

function CheckoutCard({
  checkout,
  acting,
  failed,
  onPay,
  onCancel,
}: {
  checkout: MockCheckout;
  acting: MockCheckoutAction | null;
  failed: boolean;
  onPay: () => void;
  onCancel: () => void;
}) {
  const tier = TIER_NAMES[checkout.tier];
  const team = parseOwnerScope(checkout.owner)?.kind === 'team';
  const money = (amount: number) => formatPrice(amount, checkout.currency);
  const total = money(checkout.amount);
  return (
    <BillingCard className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-6 bg-slate-50 p-6 sm:p-8 dark:bg-slate-900/60">
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Subscribe to {tier}
          </span>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h1
              data-checkout-total=""
              className="text-4xl leading-none font-bold tracking-tight text-slate-900 tabular-nums dark:text-white"
            >
              {total}
            </h1>
            <span className="text-sm text-slate-500 dark:text-slate-400">a month</span>
          </div>
        </div>
        <dl
          aria-label="Order summary"
          className="flex flex-col gap-3 border-t border-slate-200 pt-5 text-sm dark:border-slate-700"
        >
          <div className="flex items-start justify-between gap-4">
            <dt className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                {tier}
                <ProBadge form="solid" size="sm" label="Pro" tooltip={false} />
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {team
                  ? `For ${checkout.ownerName}, a team’s shared library`
                  : `For ${checkout.ownerName}, your personal library`}
              </span>
            </dt>
            <dd className="font-medium text-slate-900 tabular-nums dark:text-white">{total}</dd>
          </div>
          {team ? (
            <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300">
              <dt>Seats</dt>
              <dd className="tabular-nums">
                {checkout.seats} × {money(checkout.unitAmount)} a member
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3 font-semibold text-slate-900 dark:border-slate-700 dark:text-white">
            <dt>Total a Month</dt>
            <dd className="tabular-nums">{total}</dd>
          </div>
        </dl>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Renews each month until cancelled. Cancel any time in Manage Billing, and {tier} stays on
          to the end of the month paid for.
        </p>
      </div>

      <div className="flex flex-col gap-5 p-6 sm:p-8">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Payment</h2>
        <Callout tone="warning" size="md" role="note" title="Test Mode: No Card Is Charged">
          This checkout stands in for the payment provider, so there are no card details to enter.
          Paying here switches {tier} on, and you can cancel it the same way.
        </Callout>
        {failed ? (
          <Callout tone="error" size="md" role="alert">
            That didn’t go through. Check your connection and try again. Nothing was charged.
          </Callout>
        ) : null}
        <div className="mt-auto flex flex-col gap-2.5 pt-2">
          <Button size="lg" className="w-full" busy={acting !== null} onClick={onPay}>
            {acting === 'pay' ? <Spinner size={16} /> : null}
            {acting === 'pay' ? 'Subscribing…' : 'Pay and Subscribe'}
          </Button>
          <Button
            variant="ghost"
            size="md"
            className="min-h-11 w-full"
            busy={acting !== null}
            onClick={onCancel}
          >
            {acting === 'cancel' ? 'Going Back…' : 'Cancel'}
          </Button>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <LockIcon aria-hidden />
          Your subscription starts the moment you pay.
        </p>
      </div>
    </BillingCard>
  );
}
