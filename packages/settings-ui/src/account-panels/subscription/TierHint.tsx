'use client';

import { TIER_NAMES } from '@liveworkspace/subscription';
// The light half only: the rail is drawn with the panel, before the Subscription category's own chunk.
import { useSubscription } from '@liveworkspace/subscription-ui/provider';

/**
 * The tier named at the right of the rail's Subscription row (subscription.md "Settings, Subscription"): Free or
 * Pro, so the person knows where they stand before opening the category. Nothing while the service has not answered,
 * so no word is drawn and then swapped.
 */
export function SubscriptionTierHint() {
  const load = useSubscription();
  if (load.status !== 'ready') return null;
  return <>{TIER_NAMES[load.me.personal.tier]}</>;
}
