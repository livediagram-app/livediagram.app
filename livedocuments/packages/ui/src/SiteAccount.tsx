'use client';

import { lazy, Suspense, useSyncExternalStore } from 'react';
import {
  AccountMenuPlaceholder,
  DeferredAccountMenu,
} from '@liveworkspace/account-menu/placeholder';
import { useSignedInHint } from './HeaderPrimaryCta';

// The site header's account menu (docs/specs/019-marketing/marketing-site.md "Header"), at the bar's right end:
// liveworkspace.app's account menu for someone signed in, and the same control as Guest for a visitor. The hint
// cookie decides, read after hydration; until then the avatar's disc holds the place for everyone. The menu's code
// is its own chunk (SiteAccountMenu): loaded at once when the hint says signed in, and for a visitor only when the
// pointer or focus reaches the Guest button (DeferredAccountMenu), so a visitor's page carries none of it and makes
// no request.
const loadMenu = () => import('./SiteAccountMenu');
const SiteAccountMenu = lazy(loadMenu);

const noSubscription = () => () => {};
const hydratedNow = () => true;
const notHydrated = () => false;

export function SiteAccount() {
  const hydrated = useSyncExternalStore(noSubscription, hydratedNow, notHydrated);
  const signedIn = useSignedInHint();
  if (!hydrated) return <AccountMenuPlaceholder />;
  if (!signedIn) return <DeferredAccountMenu load={loadMenu} />;
  return (
    <Suspense fallback={<AccountMenuPlaceholder />}>
      <SiteAccountMenu />
    </Suspense>
  );
}
