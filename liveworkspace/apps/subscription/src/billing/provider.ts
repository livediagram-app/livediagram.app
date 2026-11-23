// Billing sits behind one provider interface (subscription.md "Billing"). A provider sends a person to its checkout
// and to its billing portal. What happens there comes back its own way: the mock's pages write the row
// (`subscribed`, `applyChange`, src/subscriptions), and Stripe's webhooks have it read from Stripe (./stripe/sync.ts).

import type { Currency, OwnerScope, PaidTier } from '@liveworkspace/subscription';
import { environmentOf, type Env } from '../env';
import { mockProvider } from './mock';
import { stripeApi } from './stripe/api';
import { STRIPE, stripeConfig } from './stripe/config';
import { stripeProvider } from './stripe/provider';

export type CheckoutStart = {
  owner: OwnerScope;
  /** The person's or the team's name, as the checkout shows it. */
  ownerName: string;
  tier: PaidTier;
  seats: number;
  currency: Currency;
  /** One seat's monthly amount. */
  unitAmount: number;
  returnTo: string;
  /** The account starting the checkout. */
  by: string;
};

export type PortalOpen = { owner: OwnerScope; ownerName: string; returnTo: string; by: string };

export type BillingProvider = {
  name: string;
  /** Where to send the person to pay, or that a checkout they had open was paid meanwhile. */
  startCheckout: (
    start: CheckoutStart,
    now: number,
  ) => Promise<{ url: string } | 'already_subscribed'>;
  /** Where to send the person to manage what they pay for, or that the provider can't say yet. */
  openPortal: (open: PortalOpen, now: number) => Promise<{ url: string } | 'billing_unavailable'>;
};

type ProviderEnv = Pick<
  Env,
  | 'BILLING_PROVIDER'
  | 'ENVIRONMENT'
  | 'STRIPE_SECRET_KEY'
  | 'STRIPE_WEBHOOK_SECRET'
  | 'STRIPE_PRICE_PRO'
  | 'STRIPE_PRICE_TEAM'
  | 'STRIPE_PORTAL_CONFIGURATION'
>;

/** What BILLING_PROVIDER says, lower case, or `none`. */
function named(env: Pick<Env, 'BILLING_PROVIDER'>): string {
  return env.BILLING_PROVIDER?.trim().toLowerCase() || 'none';
}

/**
 * Whether the mock provider may be used: BILLING_PROVIDER names it AND this is not production. The mock takes no
 * card, so in production it would give Pro away: whatever the var says there, it does not exist.
 */
export function isMock(env: ProviderEnv): boolean {
  return named(env) === 'mock' && environmentOf(env) !== 'production';
}

/** Whether Stripe is the provider: BILLING_PROVIDER names it and it has everything it needs (./stripe/config.ts). */
export function isStripe(env: ProviderEnv): boolean {
  return named(env) === STRIPE && stripeConfig(env) !== null;
}

/** The provider in use, as `/me` names it: `stripe`, `mock`, or `none` for no provider this Worker has here. */
export function providerName(env: ProviderEnv): string {
  if (isStripe(env)) return STRIPE;
  return isMock(env) ? 'mock' : 'none';
}

/** The provider BILLING_PROVIDER names, or null for none, one this Worker does not know, one missing what it needs,
 *  or the mock in production: it fails closed, and says so in the log. */
export function billingProvider(env: Env, fetcher: typeof fetch = fetch): BillingProvider | null {
  const stripe = named(env) === STRIPE ? stripeConfig(env) : null;
  if (stripe)
    return stripeProvider(env.SUBSCRIPTION_DB, stripe, stripeApi(stripe.secretKey, fetcher));
  if (isMock(env)) return mockProvider(env);
  console.error(
    `[subscription] BILLING_PROVIDER is "${named(env)}" in ${environmentOf(env)}: no provider exists for it here (Stripe needs its key, webhook secret and both Prices; the mock never does in production), so checkout and the portal answer 503`,
  );
  return null;
}
