// The canvas toolbars' items, a touch tighter on a phone (below `sm`, the same
// breakpoint as useIsMobileViewport): each square button gives up 4px and each
// picker 4px of side padding, so the top row fits the menu card beside the strip and the
// bottom-right cluster takes less of the canvas (docs/specs/007-editor/toolbar-layout.md
// "On a phone"). Set on a toolbar's card, it reaches the items inside by
// their size classes, so no item needs a phone-only prop of its own. Menus
// portal out of the card (or use their own row classes), so they keep their size.
export const PHONE_COMPACT_ITEMS =
  'max-sm:[&_.h-9]:h-8 max-sm:[&_.w-9]:w-8 max-sm:[&_.h-11]:h-10 max-sm:[&_.w-11]:w-10 max-sm:[&_.px-2]:px-1 max-sm:[&_.w-12]:w-11';
