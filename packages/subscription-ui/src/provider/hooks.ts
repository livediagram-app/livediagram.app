'use client';

import { useContext, useEffect, useSyncExternalStore } from 'react';
import { PLATFORM_SITE, workspaceOriginFor } from '@liveworkspace/sites';
import type { OwnerScope, PriceList } from '@liveworkspace/subscription';
import { proOn } from '../flag';
import {
  OWNER_LOADING,
  OWNER_OFF,
  OWNER_SIGNED_OUT,
  SUBSCRIPTION_OFF,
  type OwnerViewLoad,
  type SubscriptionLoad,
} from '../state';
import { SubscriptionContext, type SubscriptionHost, type UpgradeTarget } from './context';

/** The provider above, or null when none is mounted or Pro is off. */
export function useSubscriptionHost(): SubscriptionHost | null {
  const host = useContext(SubscriptionContext);
  return proOn() ? host : null;
}

/** The signed-in person's subscription, usage and teams: `loading`, `signed_out`, `ready` (with `me`) or `error`.
 *  `off`, the same object every time, when Pro is off or no provider is mounted; nothing is asked then. */
export function useSubscription(): SubscriptionLoad {
  return useSubscriptionHost()?.load ?? SUBSCRIPTION_OFF;
}

/** Reads the person's subscription and every asked owner view again (after a change the page made). A no-op when
 *  Pro is off. */
export function useRefreshSubscription(): () => Promise<void> {
  return useSubscriptionHost()?.refresh ?? noRefresh;
}
const noRefresh = async () => {};

/** What this person may know of the owner of the open item (`p:<accountId>` or `t:<teamId>`): its tier, its limits
 *  and the action they may take. Asked once per owner per page. `off` when Pro is off, no provider is mounted or
 *  `owner` is not known yet. */
export function useOwnerView(owner: OwnerScope | null | undefined): OwnerViewLoad {
  const host = useSubscriptionHost();
  const ask = host?.askOwnerView;
  const known = host?.account === 'in';
  useEffect(() => {
    if (ask && owner && known) ask(owner);
  }, [ask, owner, known]);
  if (!host || !owner) return OWNER_OFF;
  if (host.account === 'out') return OWNER_SIGNED_OUT;
  return host.ownerViews[owner] ?? OWNER_LOADING;
}

/** The prices in the visitor's currency, or null until the service has answered (and always with Pro off). */
export function usePrices(): PriceList | null {
  const host = useSubscriptionHost();
  const ask = host?.askPrices;
  // A signed-in person's prices come with their subscription; anyone else's are asked for on their own.
  const wanted = !!host && host.prices === null && host.load.status !== 'loading';
  useEffect(() => {
    if (ask && wanted) ask();
  }, [ask, wanted]);
  return host?.prices ?? null;
}

const noChange = () => () => {};
const pricingFromHere = () => `${workspaceOriginFor(window.location.host)}/pricing`;
const pricingOnServer = () => `${PLATFORM_SITE.url}/pricing`;

/** The pricing page's address: the provider's, else liveworkspace.app's as seen from this page. */
export function usePricingHref(): string {
  const host = useSubscriptionHost();
  const fallback = useSyncExternalStore(noChange, pricingFromHere, pricingOnServer);
  return host?.pricingHref ?? fallback;
}

export type Upgrade = {
  /** Whether a provider is mounted: the dialog opens in place. Without one, `openUpgrade` goes to the pricing page. */
  inPlace: boolean;
  /** Opens the upgrade dialog, set to `target.owner` (the person's own when not given). */
  openUpgrade: (target?: UpgradeTarget) => void;
  /** Opens Ask an Admin for a team's member. */
  openAskAdmin: (target?: UpgradeTarget) => void;
  pricingHref: string;
};

/** How anything under the provider opens the one upgrade dialog. */
export function useUpgrade(): Upgrade {
  const host = useSubscriptionHost();
  const pricingHref = usePricingHref();
  if (host)
    return {
      inPlace: true,
      openUpgrade: host.openUpgrade,
      openAskAdmin: host.openAskAdmin,
      pricingHref,
    };
  const toPricing = () => window.location.assign(pricingHref);
  return { inPlace: false, openUpgrade: toPricing, openAskAdmin: toPricing, pricingHref };
}

export type Billing = Pick<SubscriptionHost, 'checkout' | 'portal' | 'askTeam' | 'dismissEnded'>;

/** Starting a checkout, opening the billing portal, asking a team's admins for Pro for Teams and dismissing
 *  "You're Back on Free", or null without a provider. */
export function useBilling(): Billing | null {
  return useSubscriptionHost();
}
