// The Stripe provider (subscription.md "Stripe"): Subscribe opens Stripe Checkout, with Managed Payments so Stripe is
// the seller, and Manage Billing opens Stripe's billing portal. What happens there comes back by webhook
// (./webhook.ts), never by these calls.

import { isOwnerScope } from '@liveworkspace/subscription';
import { STRIPE_CHECKOUT_TTL_MS } from '../../config';
import type { BillingProvider, CheckoutStart } from '../provider';
import {
  StripeError,
  type StripeCall,
  type StripeCheckoutSession,
  type StripeSubscription,
} from './api';
import { STRIPE, type StripeConfig } from './config';
import { readStripeCustomer, rememberOpenCheckout } from './customers';
import { syncSubscription } from './sync';

/** Where a cancelled checkout comes back to: the page it left, without the marker a paid one carries. */
function cancelUrl(returnTo: string): string {
  const url = new URL(returnTo);
  url.searchParams.delete('subscribed');
  return url.href;
}

/** The fields of a new Checkout Session. Pure, for the tests to read. */
export function checkoutFields(
  config: StripeConfig,
  start: CheckoutStart,
  customer: string | null,
  now: number,
) {
  const metadata = { owner: start.owner, by: start.by, unit_amount: start.unitAmount };
  return {
    mode: 'subscription',
    line_items: [{ price: config.prices[start.tier], quantity: start.seats }],
    currency: start.currency.toLowerCase(),
    // Stripe is the merchant of record: it works out and files the tax, which every price includes.
    managed_payments: { enabled: true },
    customer: customer ?? undefined,
    client_reference_id: start.owner,
    success_url: start.returnTo,
    cancel_url: cancelUrl(start.returnTo),
    expires_at: Math.floor((now + STRIPE_CHECKOUT_TTL_MS) / 1000),
    metadata,
    subscription_data: {
      metadata,
      description: start.tier === 'team' ? `Pro (for Teams): ${start.ownerName}` : undefined,
    },
  };
}

/**
 * The checkout an owner had open, expired so it can't be paid as well as the new one. Answers whether it was paid
 * already: then its subscription is written now, and no new checkout is made.
 */
async function closeOpenCheckout(
  db: D1Database,
  config: StripeConfig,
  call: StripeCall,
  session: string,
  now: number,
): Promise<boolean> {
  try {
    await call('POST', `/checkout/sessions/${encodeURIComponent(session)}/expire`);
    return false;
  } catch (error) {
    if (!(error instanceof StripeError) || error.status >= 500) throw error;
  }
  // Not open any more: expired by Stripe, or paid.
  const read = await call<StripeCheckoutSession & { status?: string }>(
    'GET',
    `/checkout/sessions/${encodeURIComponent(session)}`,
  );
  if (read.status !== 'complete' || !read.subscription) return false;
  await syncSubscription(db, config, call, read.subscription, now);
  return true;
}

export function stripeProvider(
  db: D1Database,
  config: StripeConfig,
  call: StripeCall,
): BillingProvider {
  return {
    name: STRIPE,
    async startCheckout(start, now) {
      const held = await readStripeCustomer(db, start.owner);
      if (held?.open_checkout && (held.open_checkout_expires ?? 0) > now) {
        const paid = await closeOpenCheckout(db, config, call, held.open_checkout, now);
        if (paid) return 'already_subscribed';
      }
      const session = await call<StripeCheckoutSession>(
        'POST',
        '/checkout/sessions',
        checkoutFields(config, start, held?.customer ?? null, now),
      );
      if (!session.url) throw new Error('Stripe made a checkout without a link');
      await rememberOpenCheckout(db, start.owner, session.id, now + STRIPE_CHECKOUT_TTL_MS, now);
      return { url: session.url };
    },
    async openPortal(open) {
      const held = await readStripeCustomer(db, open.owner);
      // A subscriber's customer is kept by the webhook that made them one: none means Stripe has not been heard from.
      if (!held?.customer) return 'billing_unavailable';
      const session = await call<{ url: string }>('POST', '/billing_portal/sessions', {
        customer: held.customer,
        return_url: open.returnTo,
        configuration: config.portalConfiguration ?? undefined,
      });
      return { url: session.url };
    },
  };
}

/**
 * Sets a team's Stripe subscription to `seats` (subscription.md "Stripe": seats follow its joined members), charged
 * for the rest of the month on the next invoice, and answers whether Stripe took it. The row is written from what
 * Stripe then holds.
 */
export async function setStripeSeats(
  db: D1Database,
  config: StripeConfig,
  call: StripeCall,
  subscriptionId: string,
  seats: number,
  now: number,
): Promise<boolean> {
  const path = `/subscriptions/${encodeURIComponent(subscriptionId)}`;
  const sub = await call<StripeSubscription>('GET', path);
  const item = sub.items?.data?.[0];
  if (!item || !isOwnerScope(sub.metadata?.owner)) return false;
  if (item.quantity !== seats) {
    await call('POST', path, {
      items: [{ id: item.id, quantity: seats }],
      proration_behavior: 'create_prorations',
    });
  }
  await syncSubscription(db, config, call, subscriptionId, now);
  return true;
}
