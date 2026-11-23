'use client';

import type { ReactNode } from 'react';
import { SubscriptionProvider, useSubscriptionHost } from '@liveworkspace/subscription-ui/provider';
import { proOn } from '@liveworkspace/subscription-ui/flag';
import type { SubscriptionAccess } from '../host';

/**
 * The Settings panel's own read of the person's subscription, shared by every cell of the Subscription category
 * (liveworkspace/docs/specs/019-subscription/subscription.md "Settings, Subscription"). Where the page already has a
 * SubscriptionProvider (an editor that shows meters, liveworkspace.app's header), the panel uses that one and asks
 * nothing again; where it has none, the panel mounts its own over the host's access. With Pro off, or for a host
 * without access (a guest), it is its children alone.
 */
export function SubscriptionScope({
  access,
  children,
}: {
  access: SubscriptionAccess | null;
  children: ReactNode;
}) {
  const outer = useSubscriptionHost();
  if (!access || outer || !proOn()) return <>{children}</>;
  const { origin, ...rest } = access;
  const at = typeof origin === 'function' ? origin() : origin;
  return (
    <SubscriptionProvider {...rest} {...(at ? { origin: at } : {})}>
      {children}
    </SubscriptionProvider>
  );
}
