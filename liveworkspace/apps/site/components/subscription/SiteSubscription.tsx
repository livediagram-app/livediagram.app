'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
// The light half only (the provider's shell and hooks): this is in the header, on every page's first load.
import {
  SubscriptionProvider,
  useSubscriptionHost,
  type AccountKnown,
} from '@liveworkspace/subscription-ui/provider';
import { proOn } from '@liveworkspace/subscription-ui/flag';
import {
  subscriptionFetch,
  subscriptionOrigin,
  subscriptionSignInHref,
  subscriptionToken,
} from '@/lib/subscription';

const noChange = () => () => {};
const noOrigin = () => '';

/**
 * This site's read of the signed-in person's subscription (liveworkspace/docs/specs/019-subscription/
 * subscription.md "What people see"), around whatever shows it: the header's account menu and the Settings panel it
 * opens, the pricing page. One per page: inside another it is its children alone, so the page asks once. `account`
 * says whether the page knows who is here; while it is `checking`, or for a visitor (`out`), nothing is asked.
 *
 * With Pro off in the build it is its children alone, and no request is made.
 */
export function SiteSubscription({
  account,
  children,
}: {
  account: AccountKnown;
  children: ReactNode;
}) {
  const outer = useSubscriptionHost();
  const origin = useSyncExternalStore(noChange, subscriptionOrigin, noOrigin);
  if (!proOn() || outer) return <>{children}</>;
  return (
    <SubscriptionProvider
      getToken={subscriptionToken}
      origin={origin}
      account={account}
      signInHref={subscriptionSignInHref}
      {...(subscriptionFetch ? { fetch: subscriptionFetch } : {})}
    >
      {children}
    </SubscriptionProvider>
  );
}
