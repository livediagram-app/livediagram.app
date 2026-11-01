'use client';

import { AppAccountMenu, type DeferredMenuProps } from '@liveworkspace/account-menu';
import { SIGNED_IN_HINT_COOKIE } from '@livehuddle/api-schema';

// The account menu on this app's own pages (@liveworkspace/account-menu's AppAccountMenu), with this app's hint
// cookie. Loaded lazily by SiteAccount: at once for someone signed in, and for a
// visitor when the Guest button is first approached, carrying on from it (opened, or focused).
export default function SiteAccountMenu(arrival: DeferredMenuProps) {
  return <AppAccountMenu hint={SIGNED_IN_HINT_COOKIE} {...arrival} />;
}
