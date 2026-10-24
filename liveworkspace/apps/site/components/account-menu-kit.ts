import type { AccountMenuKit } from '@liveworkspace/account-menu';
import { lucideGlyph } from '@livediagram/ui';
import { useClickOutside, useMenu, useMenuButton, type MenuInitialFocus } from '@liveworkspace/ui';
import { lucideChevronDown, lucideKey, lucideSettings } from '@liveworkspace/icons/lucide';

// The site's menu hooks and icons for the shared account menu (@liveworkspace/account-menu): the ones the rest of
// the site's menus use, from the shared design system (@liveworkspace/ui) and livediagram's icons.
export const ACCOUNT_MENU_KIT: AccountMenuKit<MenuInitialFocus> = {
  useMenuButton,
  useMenu,
  useClickOutside,
  icons: {
    chevron: lucideGlyph(lucideChevronDown, 16),
    tokens: lucideGlyph(lucideKey, 16),
    settings: lucideGlyph(lucideSettings, 16),
  },
};
