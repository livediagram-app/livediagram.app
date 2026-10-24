'use client';

import { createContext, useContext } from 'react';

// The menu a component renders inside (docs/specs/004-interface-design/menus.md). A row primitive
// reads its kind to pick its role: a menu item in a command menu, a plain control in a control menu
// or outside any menu. A submenu reads its parent to know it is one, and to close the whole tree
// on Tab. React context crosses portals, so a portalled flyout still sees the menu it opened from.

export type MenuKind = 'command' | 'control';

export type MenuTree = {
  kind: MenuKind;
  /** The menu element's id: a submenu names it in `data-menu-parent`. */
  id: string;
  /** Close every menu of the tree and move focus on, as Tab does (backwards for Shift+Tab). */
  closeTree: (backwards: boolean) => void;
};

export const MenuTreeContext = createContext<MenuTree | null>(null);

/** The kind of menu this component sits in; null outside any menu. */
export function useMenuKind(): MenuKind | null {
  return useContext(MenuTreeContext)?.kind ?? null;
}
