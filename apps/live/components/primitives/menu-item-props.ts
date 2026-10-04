'use client';

import { useMenuKind } from '@livediagram/ui';

// The role a menu row takes from the menu it sits in (docs/specs/004-interface-design/menus.md;
// blueprint "Row primitives by kind"). In a command menu a row is a menu item: one of the roving
// keys' stops (`tabIndex -1`), a checkable entry when it carries an on/off state, and disabled by
// `aria-disabled` so it stays focusable (D50). In a control menu, or outside any menu, it is the
// plain control it always was, and this adds nothing.

export type MenuItemProps = {
  role?: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio';
  tabIndex?: -1;
  'aria-checked'?: boolean;
  'aria-disabled'?: true;
};

export function useMenuItemProps({
  disabled = false,
  checked,
  radio = false,
}: {
  disabled?: boolean;
  /** An on/off (or one-of-a-set, with `radio`) state; undefined for a plain verb. */
  checked?: boolean;
  radio?: boolean;
} = {}): { inCommandMenu: boolean; itemProps: MenuItemProps } {
  const kind = useMenuKind();
  if (kind !== 'command') return { inCommandMenu: false, itemProps: {} };
  return {
    inCommandMenu: true,
    itemProps: {
      role: checked === undefined ? 'menuitem' : radio ? 'menuitemradio' : 'menuitemcheckbox',
      tabIndex: -1,
      ...(checked === undefined ? null : { 'aria-checked': checked }),
      ...(disabled ? { 'aria-disabled': true as const } : null),
    },
  };
}
