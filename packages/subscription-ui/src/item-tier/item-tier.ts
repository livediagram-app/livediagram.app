'use client';

// Who is looking at an item's tier limits, in every app (liveworkspace/docs/specs/019-subscription/subscription.md
// "Who pays for an item", "What a collaborator is told"): the item's owner as its api named it, what this person may
// know of it and do about it, and the owner's own usage where it is theirs to see.
// With Pro off (in this build, or on the server, which then names no owner) it answers `on: false` and asks nothing.
// The light half of the kit only, so anything on the first load may read it.

import {
  GAUGE_LIMIT,
  ITEM_METER_LIMIT,
  isOwnerScope,
  parseOwnerScope,
  SPEND_METER_LIMIT,
  TIER_NAMES,
  type Gauge,
  type ItemMeter,
  type OwnerView,
  type PaidTier,
  type SpendMeter,
  type SubscriptionSummary,
} from '@liveworkspace/subscription';
import { proOn } from '../flag';
import { useOwnerView, useSubscription } from '../provider';
import type { OwnerViewLoad } from '../state';
import { useMemo } from 'react';

/** How a limit is worded for this person: the owner's tier by name where they may know it, and the tier above where
 *  they may move to it. */
export type TierVoice = {
  /** "Free", "Pro", "Pro for Teams"; null for someone outside the owner, who is never told. */
  tier: string | null;
  /** The tier this person may move the owner to; null for a team's member, a collaborator, and an owner already
   *  there. */
  offer: { tier: PaidTier; name: string } | null;
  /** Whose the item is, for "until you have Pro" and "until this team has Pro for Teams". */
  whose: 'yours' | 'team' | 'owner';
};

export const PLAIN_VOICE: TierVoice = { tier: null, offer: null, whose: 'owner' };

export type ItemTierView = {
  /** Pro is on, in this build and on the server (which named the item's owner). */
  on: boolean;
  /** The owner view as the kit's notices and gates take it. */
  owner: OwnerViewLoad;
  /** The service has answered who is looking (or cannot): a notice waits for it, so its words never change under
   *  the reader from the plain ones to the owner's. */
  settled: boolean;
  action: OwnerView['action'];
  /** The owner has Pro or Pro for Teams, where this person may know it: the solid badge follows a meter. */
  paid: boolean;
  voice: TierVoice;
  /** The owner's subscription and usage, for the owner or someone on the owning team; null for anyone else. */
  summary: SubscriptionSummary | null;
};

export const ITEM_TIER_OFF: ItemTierView = {
  on: false,
  owner: { status: 'off' },
  settled: true,
  action: 'none',
  paid: false,
  voice: PLAIN_VOICE,
  summary: null,
};

function voiceOf(view: OwnerView | null): TierVoice {
  if (!view) return PLAIN_VOICE;
  const team = parseOwnerScope(view.owner)?.kind === 'team';
  const to: PaidTier = team ? 'team' : 'pro';
  const may = view.action === 'upgrade' || view.action === 'manage';
  return {
    tier: view.tier ? TIER_NAMES[view.tier] : null,
    offer:
      view.action === 'upgrade' && view.tier !== null && view.tier !== to
        ? { tier: to, name: TIER_NAMES[to] }
        : null,
    whose: team && view.action !== 'none' ? 'team' : may ? 'yours' : 'owner',
  };
}

/** The tier of the item whose owner the api named (`owner` on a list, a link or a refusal's read). */
export function useItemTier(scope: string | null | undefined): ItemTierView {
  const owner = proOn() && isOwnerScope(scope) ? scope : null;
  const load = useOwnerView(owner);
  const mine = useSubscription();
  // One object while nothing it reads changes, so a context that shares it does not move every render.
  return useMemo(() => {
    if (!owner) return ITEM_TIER_OFF;
    const view = load.status === 'ready' ? load.view : null;
    const me = mine.status === 'ready' ? mine.me : null;
    const summary = !me
      ? null
      : me.personal.owner === owner
        ? me.personal
        : (me.teams.find((team) => team.owner === owner) ?? null);
    return {
      on: true,
      owner: load,
      settled: load.status !== 'loading',
      action: view?.action ?? 'none',
      paid: !!view?.tier && view.tier !== 'free',
      voice: voiceOf(view),
      summary,
    };
  }, [owner, load, mine]);
}

/** The signed-in person's own subscription and usage (an AI draft for nothing yet made spends their own credit). */
export function useOwnTier(): ItemTierView {
  const mine = useSubscription();
  const scope = mine.status === 'ready' ? mine.me.personal.owner : null;
  return useItemTier(scope);
}

/** What the owner has used of a monthly meter this month, of a standing count (their rules, their pages) or of a
 *  gauge (their published roadmaps) over everything they own, and its most, where this person may know both. A
 *  limit of none reads as null. */
export function tierUsage(
  tier: ItemTierView,
  usage: SpendMeter | ItemMeter | Gauge,
): { used: number; limit: number } | null {
  if (!tier.summary) return null;
  const key =
    usage in ITEM_METER_LIMIT
      ? ITEM_METER_LIMIT[usage as ItemMeter]
      : usage in GAUGE_LIMIT
        ? GAUGE_LIMIT[usage as Gauge]
        : SPEND_METER_LIMIT[usage as SpendMeter];
  const limit = tier.summary.limits[key];
  if (limit === null) return null;
  return { used: tier.summary.usage[usage]?.used ?? 0, limit };
}
