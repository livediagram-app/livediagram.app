'use client';

import { AppAccountMenu, type AccountMenuKit } from '@liveworkspace/account-menu';
import { SIGNED_IN_HINT_COOKIE } from '@livediagram/api-schema';
import {
  lucideChevronDown,
  lucideKey,
  lucideSettings,
  lucideUsers,
} from '@livediagram/icons/lucide';
import { lucideGlyph } from './icons/lucide-glyph';
import { useMenu, useMenuButton, type MenuInitialFocus } from './menu';
import { useClickOutside } from './useClickOutside';

// The account menu on this app's own pages (@liveworkspace/account-menu's AppAccountMenu), with this package's menu
// hooks and icons and this app's hint cookie. Loaded lazily by SiteAccount, only for someone signed in.
const KIT: AccountMenuKit<MenuInitialFocus> = {
  useMenuButton,
  useMenu,
  useClickOutside,
  icons: {
    chevron: lucideGlyph(lucideChevronDown, 16),
    teams: lucideGlyph(lucideUsers, 16),
    tokens: lucideGlyph(lucideKey, 16),
    settings: lucideGlyph(lucideSettings, 16),
  },
};

export default function SiteAccountMenu() {
  return <AppAccountMenu hint={SIGNED_IN_HINT_COOKIE} kit={KIT} />;
}
