'use client';

import { lazy, Suspense } from 'react';
import { AccountMenuPlaceholder } from '@liveworkspace/account-menu/placeholder';
import { useSignedInHint } from './HeaderPrimaryCta';

// The site header's account menu (docs/specs/019-marketing/marketing-site.md "Header"): for someone signed in,
// liveworkspace.app's account menu at the bar's right end; for a visitor, nothing. The hint cookie decides, read
// after hydration (false in the static HTML), and the menu's code is its own chunk (SiteAccountMenu), loaded only
// then, so a visitor's page carries none of it. While it loads, the avatar's disc holds the place.
const SiteAccountMenu = lazy(() => import('./SiteAccountMenu'));

export function SiteAccount() {
  const signedIn = useSignedInHint();
  if (!signedIn) return null;
  return (
    <Suspense fallback={<AccountMenuPlaceholder />}>
      <SiteAccountMenu />
    </Suspense>
  );
}
