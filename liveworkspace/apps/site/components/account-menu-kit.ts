import type { AccountMenuKit } from '@liveworkspace/account-menu';
import {
  lucideGlyph,
  useClickOutside,
  useMenu,
  useMenuButton,
  type MenuInitialFocus,
} from '@livediagram/ui';
import {
  lucideChevronDown,
  lucideKey,
  lucideSettings,
  lucideUsers,
} from '@livediagram/icons/lucide';

// The site's menu hooks and icons for the shared account menu (@liveworkspace/account-menu): the ones the rest of
// the site's menus use, from livediagram's UI package.
export const ACCOUNT_MENU_KIT: AccountMenuKit<MenuInitialFocus> = {
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
