'use client';

// The month's AI credits around an AI ask, in every app (liveworkspace/docs/specs/019-subscription/subscription.md
// "Tiers and limits"): whether they are known to be used (the owner's usage where this person may
// see it, or the api's refusal, which says so to anyone), and the usage read again once an ask has settled so the
// line under the box counts what the ask spent.

import { useCallback, useState } from 'react';
import { useTierReread } from './use-tier-reread';
import { useRefreshSubscription } from '../provider';
import { tierUsage, type ItemTierView } from './item-tier';

export type CreditsSpent = { used: number; max: number };

/** The credits a refusal carried (its `tier`: an Automations draft's, a plan's or a form's, a knowledgebase's ask),
 *  or null for any other failure. */
export function creditsRefusal(error: unknown): CreditsSpent | null {
  const tier =
    typeof error === 'object' && error !== null ? (Reflect.get(error, 'tier') as unknown) : null;
  if (typeof tier !== 'object' || tier === null) return null;
  const limit: unknown = Reflect.get(tier, 'limit');
  const used: unknown = Reflect.get(tier, 'used');
  const max: unknown = Reflect.get(tier, 'max');
  return limit === 'aiCreditsPerMonth' && typeof used === 'number' && typeof max === 'number'
    ? { used, max }
    : null;
}

export function useAiCredits(tier: ItemTierView) {
  const refresh = useRefreshSubscription();
  const [refused, setRefused] = useState<CreditsSpent | null>(null);
  // A refusal from before an upgrade is not the month's word any more: it is forgotten, and the usage read again,
  // when the owner's tier or what this person may do changes and when the window is looked at again, so the ask
  // can be made again without a reload (the api decides).
  const again = useCallback(() => {
    setRefused(null);
    void refresh();
  }, [refresh]);
  useTierReread(tier, again);
  const known = tier.on ? tierUsage(tier, 'aiCredits') : null;
  const spent: CreditsSpent | null =
    refused ??
    (known && known.limit > 0 && known.used >= known.limit
      ? { used: known.used, max: known.limit }
      : null);
  /** Takes a failed ask: true when the month's credits refused it (the notice says so in place of the words). */
  const take = useCallback((error: unknown): boolean => {
    const credits = creditsRefusal(error);
    if (credits) setRefused(credits);
    return credits !== null;
  }, []);
  /** An ask has settled: what is used is read again. Nothing is asked with Pro off. */
  const settle = useCallback(() => {
    if (tier.on) void refresh();
  }, [tier.on, refresh]);
  return { spent: tier.on ? spent : null, take, settle };
}
