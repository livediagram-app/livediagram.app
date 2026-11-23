'use client';

// A limit's control recovers without a reload (liveworkspace/docs/specs/019-subscription/subscription.md "What people
// see"): what the api said of an item's limits is read again when who is looking or the owner's
// tier changes (an upgrade from the panel), and when the window is looked at again (the upgrade happened in another
// tab). A look again also asks the service afresh who owns what, so the owner's tier (its badge, its words, the
// offer) catches up with the limits the api now gives, not up to five minutes later. With Pro off nothing is listened
// to and nothing is read.

import { useRefreshSubscription } from '../provider';
import { useEffect, useRef } from 'react';
import type { ItemTierView } from './item-tier';

/** A return to the window reads again at most this often. */
export const FOCUS_REREAD_MS = 5_000;

/** After the owner's tier changes, the api may still answer from what it last heard of the subscription service (a
 *  minute, @liveworkspace/subscription ENTITLEMENT_FRESH_MS): the limits are read once more after that. */
export const SETTLE_REREAD_MS = 70_000;

/** What of a tier, when it changes, makes a limit read stale: who is looking, what they may do, the owner's tier. */
export function tierKey(tier: ItemTierView): string {
  const view = tier.owner.status === 'ready' ? tier.owner.view : null;
  return [tier.on ? 'on' : 'off', tier.action, view?.owner ?? '', view?.tier ?? ''].join('|');
}

/** Calls `again` when the tier's key changes after the first settled read, and when the window regains focus. */
export function useTierReread(tier: ItemTierView, again: () => void): void {
  const latest = useRef(again);
  const refresh = useRefreshSubscription();
  const refreshing = useRef(refresh);
  useEffect(() => {
    latest.current = again;
    refreshing.current = refresh;
  }, [again, refresh]);
  const key = tier.on && tier.settled ? tierKey(tier) : null;
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (key === null) return;
    const before = seen.current;
    seen.current = key;
    if (before === null || before === key) return;
    latest.current();
    const settled = setTimeout(() => latest.current(), SETTLE_REREAD_MS);
    return () => clearTimeout(settled);
  }, [key]);
  const on = tier.on;
  useEffect(() => {
    if (!on) return;
    let last = 0;
    const focused = () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - last < FOCUS_REREAD_MS) return;
      last = now;
      latest.current();
      void refreshing.current();
    };
    window.addEventListener('focus', focused);
    document.addEventListener('visibilitychange', focused);
    return () => {
      window.removeEventListener('focus', focused);
      document.removeEventListener('visibilitychange', focused);
    };
  }, [on]);
}
