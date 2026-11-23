// What the Stripe provider needs to exist (subscription.md "Billing"): its key, its webhook secret and both Prices.
// Missing any, there is no Stripe provider, and checkout and the portal say billing is unavailable.

import type { PaidTier } from '@liveworkspace/subscription';
import type { Env } from '../../env';

export const STRIPE = 'stripe';

export type StripeConfig = {
  secretKey: string;
  webhookSecret: string;
  prices: Record<PaidTier, string>;
  portalConfiguration: string | null;
};

export type StripeEnv = Pick<
  Env,
  | 'STRIPE_SECRET_KEY'
  | 'STRIPE_WEBHOOK_SECRET'
  | 'STRIPE_PRICE_PRO'
  | 'STRIPE_PRICE_TEAM'
  | 'STRIPE_PORTAL_CONFIGURATION'
>;

const read = (value: string | undefined) => value?.trim() || null;

export function stripeConfig(env: StripeEnv): StripeConfig | null {
  const secretKey = read(env.STRIPE_SECRET_KEY);
  const webhookSecret = read(env.STRIPE_WEBHOOK_SECRET);
  const pro = read(env.STRIPE_PRICE_PRO);
  const team = read(env.STRIPE_PRICE_TEAM);
  if (!secretKey || !webhookSecret || !pro || !team || pro === team) return null;
  return {
    secretKey,
    webhookSecret,
    prices: { pro, team },
    portalConfiguration: read(env.STRIPE_PORTAL_CONFIGURATION),
  };
}

/** Which tier a Price is, or null for one that is neither of ours. */
export function tierOfPrice(config: StripeConfig, priceId: string): PaidTier | null {
  if (priceId === config.prices.pro) return 'pro';
  if (priceId === config.prices.team) return 'team';
  return null;
}
