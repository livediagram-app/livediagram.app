// The canvas toolbars' items on a phone (docs/specs/007-editor/toolbar-layout.md "On a phone"):
// their pickers give up 4px of side padding, so more tiles show beside the menu card, and every
// 36px item gets a 44px-tall tap area on a touch screen (`touch-target-y`, vertical only: the items
// sit 2px apart, so a sideways pad would steal its neighbour's taps). The items keep their size; the
// bottom-right cluster's are 44px already. Set on a toolbar's card, it reaches the items inside by
// their size classes, so no item needs a phone-only prop of its own. Menus portal out of the card
// (or use their own row classes), so they are untouched.
export const PHONE_TOOLBAR_ITEMS =
  'max-sm:[&_.px-2]:px-1 [&_.h-9]:relative [&_.h-9]:touch-target-y';
