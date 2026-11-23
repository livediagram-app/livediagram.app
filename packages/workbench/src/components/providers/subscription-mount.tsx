'use client';

// The one place every editor mounts Pro (liveworkspace/docs/specs/019-subscription/subscription.md "What people
// see"): the kit's provider, inside the auth context, so a meter, a notice or the upgrade dialog works anywhere in an
// editor. The light half only (`/provider`): the first load carries a context, and the half that asks the service is
// fetched once the page is interactive. With Pro off in the build the provider renders its children and nothing else.

import { useSyncExternalStore, type ReactNode } from 'react';
import { PLATFORM_SITE, workspaceOriginFor } from '@liveworkspace/sites';
import { SubscriptionProvider, type AccountKnown } from '@liveworkspace/subscription-ui/provider';
import type { DeferredAuthState } from './deferred-auth';

const noChange = () => () => {};
// liveworkspace.app as this page sees it (staging's from a staging app), where the subscription service answers.
const originHere = () => workspaceOriginFor(window.location.host);
const originOnServer = () => PLATFORM_SITE.url;

/** What the provider may ask: nothing until the session has answered, and nothing for a guest. */
export function accountKnown(
  auth: Pick<DeferredAuthState, 'authLoaded' | 'isSignedIn'>,
): AccountKnown {
  if (!auth.authLoaded) return 'checking';
  return auth.isSignedIn ? 'in' : 'out';
}

export function SubscriptionMount({
  auth,
  children,
}: {
  auth: DeferredAuthState;
  children: ReactNode;
}) {
  const origin = useSyncExternalStore(noChange, originHere, originOnServer);
  return (
    <SubscriptionProvider getToken={auth.getToken} origin={origin} account={accountKnown(auth)}>
      {children}
    </SubscriptionProvider>
  );
}
