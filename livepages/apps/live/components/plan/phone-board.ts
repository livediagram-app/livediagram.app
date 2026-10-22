// How a board is drawn for where it is (docs/specs/026-plan/plan-board.md "On a phone", "Maximised board"): on a phone
// its cards are Minimal and its widgets stand aside, and a board that scrolls on its own (maximised, filling its tab
// or in a Dashboard slot) shows one column a screen, snapping to each, its empty space taking a finger as a scroll.
// Pure.
import type { CardSize, QuickFilter } from '@livepages/items';
import type { BoardColumnLayout } from './plan-board-columns';

export type BoardPlace = {
  // Below the phone breakpoint (useIsMobileViewport).
  phone: boolean;
  // Maximised or filling its tab: the board covers the canvas.
  covering: boolean;
  // Drawn in a Dashboard slot, where the page scrolls and the canvas under it never pans.
  inSlot: boolean;
  // In Plan mode: the board takes presses at all.
  interactive: boolean;
  // A card is being carried: the columns stop snapping so the edge scroll can move them freely.
  dragging: boolean;
};

type BoardLook = {
  columns: BoardColumnLayout;
  // The board's own card size, or Minimal on a phone.
  cardSize: CardSize | undefined;
  // The header's widgets are shown (never on a phone: the header has no room for them).
  widgets: boolean;
  // The body's own scroll is a size container (the column template reads 100cqw).
  container: boolean;
  // The body's touch-action classes.
  touch: string;
  // The columns snap into view as they scroll sideways.
  snap: boolean;
  // The body's bottom padding class, when it needs more than its own: a phone's covering board runs under the
  // bottom-right controls (two rows across the screen there), so its last cards scroll up clear of them.
  endClearance: string;
};

// What a phone's bottom controls cover of a covering board (the undo, dock and Plan strip rows, measured 2026-10-11
// at 390 px: 134 px from the canvas's foot), with the home indicator's safe area.
export const PHONE_END_CLEARANCE = 'pb-[calc(8.5rem+env(safe-area-inset-bottom))]';
// A covering Sheet's: its controls are one row (undo, Style, Fit), 72 px from the canvas's foot (measured 2026-10-19 at
// 390 px), so its Setup Sheet card ends a little above them and keeps its step room to scroll.
export const PHONE_SHEET_END_CLEARANCE = 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]';

const NO_QUICK: QuickFilter = {};

export function boardLook(place: BoardPlace, cardSize: CardSize | undefined): BoardLook {
  const { phone, covering, inSlot, interactive, dragging } = place;
  // Scrolls on its own: nothing under it to pan, so its body scrolls under a finger (each card stays touch-none).
  const scrolls = covering || inSlot;
  const oneAScreen = phone && scrolls;
  return {
    columns: oneAScreen ? 'phone' : covering ? 'maximised' : 'canvas',
    cardSize: phone ? 'minimal' : cardSize,
    widgets: !phone,
    container: covering || oneAScreen,
    touch: interactive ? (scrolls ? 'touch-pan-x touch-pan-y' : 'touch-none') : '',
    snap: oneAScreen && !dragging,
    endClearance: phone && covering ? PHONE_END_CLEARANCE : '',
  };
}

// The quick filter the board applies: none on a phone, where the widgets that set it are not shown, so a filter set on
// a wider screen never hides cards with nothing on screen to say so.
export function shownQuick(quick: QuickFilter, phone: boolean): QuickFilter {
  return phone ? NO_QUICK : quick;
}
