'use client';

// An upgrade reaches an open Walkthroughs list without a reload (liveworkspace/docs/specs/006-media/walkthroughs.md
// "With Pro on"): the list's limits are read again when the tier of either scope they name changes as the page knows
// it, and once more after the door stops answering from its entitlement cache. With Pro off, or before the first
// answer, the key is null and nothing is read.

import type { WalkthroughLimits } from '@liveworkspace/media/walkthrough';
import { isOwnerScope } from '@liveworkspace/subscription';
import { useOwnerView } from '@liveworkspace/subscription-ui/provider';
import type { OwnerViewLoad } from '@liveworkspace/subscription-ui';
import { useEffect, useRef } from 'react';

/** The door answers from what it last heard of the subscription service for up to a minute
 *  (@liveworkspace/subscription ENTITLEMENT_FRESH_MS): the limits are read once more after that. */
export const TIER_SETTLE_MS = 70_000;

/** What of the two views, when it changes, makes the limits stale: each one's tier, or null until both are known. */
export function tierKey(stored: OwnerViewLoad, length: OwnerViewLoad): string | null {
  if (stored.status !== 'ready' || length.status !== 'ready') return null;
  return `${stored.view.tier ?? ''}|${length.view.tier ?? ''}`;
}

const scope = (s: string | null | undefined) => (isOwnerScope(s) ? s : null);

/** Calls `again` when the tiers behind `limits` change after the first known answer, and once more later. */
export function useTierReread(limits: WalkthroughLimits | null, again: () => void): void {
  const stored = useOwnerView(scope(limits?.storedOwner ?? limits?.owner));
  const length = useOwnerView(scope(limits?.owner));
  const key = tierKey(stored, length);
  const latest = useRef(again);
  useEffect(() => {
    latest.current = again;
  }, [again]);
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (key === null) return;
    const before = seen.current;
    seen.current = key;
    if (before === null || before === key) return;
    latest.current();
    const settled = setTimeout(() => latest.current(), TIER_SETTLE_MS);
    return () => clearTimeout(settled);
  }, [key]);
}
