// Every selector, attribute and timing the menu hooks share (docs/specs/004-interface-design/menus.md).

/** How long typed letters keep building one typeahead search (D49). */
export const MENU_TYPEAHEAD_RESET_MS = 500;

/** The three ARIA roles a command menu's items may carry. */
export const MENU_ITEM_SELECTOR =
  '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]';

/** Marks every menu surface of either kind; its value is the kind. */
export const MENU_SURFACE_ATTR = 'data-menu-surface';

/** On a submenu or sub-panel: the id of the menu it opened from. */
export const MENU_PARENT_ATTR = 'data-menu-parent';

/** On a header that names the menu it sits in. */
export const MENU_LABEL_ATTR = 'data-menu-label';

/** What a control menu's Tab walk and its first focus may land on. */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[role^="menuitem"]',
].join(',');
