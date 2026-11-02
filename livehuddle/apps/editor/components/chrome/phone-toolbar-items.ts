// The canvas toolbars' items on a phone (docs/specs/007-editor/toolbar-layout.md "On a phone"):
// their pickers give up 4px of side padding, so more tiles show beside the menu card, and every
// 36px item gets a 44px-tall tap area on a touch screen (`touch-target-y`, vertical only: the items
// sit 2px apart, so a sideways pad would steal its neighbour's taps). The items keep their size; the
// bottom-right cluster's are 44px already. Set on a toolbar's card, it reaches the items inside by
// their size classes, so no item needs a phone-only prop of its own. Menus portal out of the card
// (or use their own row classes), so they are untouched.
export const PHONE_TOOLBAR_ITEMS = 'phone:[&_.px-2]:px-1 [&_.h-9]:relative [&_.h-9]:touch-target-y';

// The bottom-right cluster's buttons on a phone (docs/specs/012-collaboration/session-tools.md "The Session
// strip"): with the Session strip there are seven 44px-wide buttons (Undo, Redo, Timer, Vote, Poll, Layers,
// the theme brush) beside Fit, more than a phone's row holds. Each takes an equal share of the width left once
// the page gutters (2 x 16px), the cluster's gaps (3 x 6px), Fit (about 45px) and the strips' borders (8px)
// are taken off: 103px in all, between 36px and the usual 44px. So the row fills the screen instead of leaving
// room on the left, and stays one row down to 360px; the buttons stay 44px tall to tap. A cluster with fewer
// buttons is narrower than the screen anyway, so its buttons reach the 44px cap.
export const PHONE_CLUSTER_BUTTON_WIDTH =
  'phone:[&_.w-11]:w-[clamp(36px,calc((100vw_-_103px)/7),44px)]';
