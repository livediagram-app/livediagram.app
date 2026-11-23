'use client';

import { createContext } from 'react';
import type {
  LimitKey,
  OwnerScope,
  PriceList,
  TeamRequestResponse,
} from '@liveworkspace/subscription';
import type { OwnerViewLoad, SubscriptionLoad } from '../state';

/** What the upgrade dialog opens on: whose subscription (the person's own when not given), the limit that was met,
 *  which the comparison points at, and the side to start on where no one team is meant (the pricing page's Get Pro
 *  for Teams). */
export type UpgradeTarget = {
  owner?: OwnerScope | null;
  limit?: LimitKey | null;
  subscribeFor?: 'me' | 'team';
};

/** Whether the page knows who is signed in yet. A page that does not ask until it knows hands `checking`. */
export type AccountKnown = 'checking' | 'out' | 'in';

/** What a SubscriptionProvider shares with everything under it. */
export type SubscriptionHost = {
  account: AccountKnown;
  load: SubscriptionLoad;
  /** Reads the person's subscription again, and every owner view the page has asked for. */
  refresh: () => Promise<void>;
  ownerViews: Readonly<Record<string, OwnerViewLoad>>;
  askOwnerView: (owner: OwnerScope) => void;
  /** The prices in the visitor's currency: the person's own once they are known, else asked for when first wanted. */
  prices: PriceList | null;
  askPrices: () => void;
  openUpgrade: (target?: UpgradeTarget) => void;
  openAskAdmin: (target?: UpgradeTarget) => void;
  /** Starts a checkout for `owner` and sends the browser to it. Rejects with the service's refusal. */
  checkout: (owner: OwnerScope) => Promise<void>;
  /** Opens the billing portal for `owner`. Rejects with the service's refusal. */
  portal: (owner: OwnerScope) => Promise<void>;
  /** Asks a team's admins for Pro for Teams, as one of its members; the team's `askedAt` follows the answer.
   *  Rejects with the service's refusal. */
  askTeam: (
    owner: OwnerScope,
    limit: LimitKey | null,
    note: string | null,
  ) => Promise<TeamRequestResponse>;
  /** "You're Back on Free" has been read for `owner`: it goes at once, and the service is told so no browser says it
   *  again. */
  dismissEnded: (owner: OwnerScope) => void;
  pricingHref: string;
  /** Where signing in goes, coming back to the given address. Null where the host handed none. */
  signInHref: ((returnTo: string) => string) | null;
};

// A subscription read this long ago is read again when the person comes back to the tab.
export const SUBSCRIPTION_STALE_MS = 5 * 60 * 1000;

export const SubscriptionContext = createContext<SubscriptionHost | null>(null);
