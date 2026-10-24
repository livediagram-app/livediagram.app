'use client';

import {
  AppAccountMenu,
  type AccountMenuKit,
  type DeferredMenuProps,
} from '@liveworkspace/account-menu';
import { SIGNED_IN_HINT_COOKIE } from '@livedocuments/api-schema';
import { lucideChevronDown, lucideKey, lucideSettings } from '@liveworkspace/icons/lucide';
import {
  lucideGlyph,
  useMenu,
  useMenuButton,
  type MenuInitialFocus,
  useClickOutside,
} from '@liveworkspace/ui';

// The account menu on this app's own pages (@liveworkspace/account-menu's AppAccountMenu), with this package's menu
// hooks and icons and this app's hint cookie. Loaded lazily by SiteAccount: at once for someone signed in, and for a
// visitor when the Guest button is first approached, carrying on from it (opened, or focused).
const KIT: AccountMenuKit<MenuInitialFocus> = {
  useMenuButton,
  useMenu,
  useClickOutside,
  icons: {
    chevron: lucideGlyph(lucideChevronDown, 16),
    tokens: lucideGlyph(lucideKey, 16),
    settings: lucideGlyph(lucideSettings, 16),
  },
};

export default function SiteAccountMenu(arrival: DeferredMenuProps) {
  return <AppAccountMenu hint={SIGNED_IN_HINT_COOKIE} kit={KIT} {...arrival} />;
}
