// How a board is drawn for where it is (docs/specs/026-plan/plan-board.md "On a phone", "Maximised board"): on a phone
// its cards are Minimal and its widgets stand aside, and a board that scrolls on its own (maximised, filling its tab
// or in a Dashboard slot) shows one column a screen, snapping each to the centre, its empty space taking a finger as a
// scroll, and a tap on a column's empty space gliding that column to the centre. Pure but for the tap's scroll.
import type { CardSize, QuickFilter } from '@liveplanner/items';
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
  // A card's touch-action classes: touch-none, so a finger on it drags it, except on a phone board that shows one
  // column a screen, where a column is mostly cards: there a finger on a card scrolls the board like empty space, and
  // a card is picked up by holding it still for CARD_HOLD_TO_DRAG_MS first (holdToDrag).
  cardTouch: string;
  holdToDrag: boolean;
  // The columns snap to the centre as they scroll sideways (each column's full-height marker, never its sticky head).
  snap: boolean;
  // The body's overscroll-behavior class: covering, its scroll stays its own; in a Dashboard slot only sideways, so
  // scrolling down past its end still scrolls the Dashboard.
  overscroll: string;
  // The body's bottom padding class, when it needs more than its own: a phone's covering board runs under the
  // bottom-right controls (two rows across the screen there), so its last cards scroll up clear of them.
  endClearance: string;
};

// What a phone's bottom controls cover of a covering board (the undo, dock and Plan strip rows, measured 2026-10-11
// at 390 px: 134 px from the canvas's foot), with the home indicator's safe area.
export const PHONE_END_CLEARANCE = 'pb-[calc(8.5rem+env(safe-area-inset-bottom))]';

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
    cardTouch: oneAScreen && interactive ? 'touch-pan-x touch-pan-y' : 'touch-none',
    holdToDrag: oneAScreen && interactive,
    snap: oneAScreen && !dragging,
    overscroll: oneAScreen ? (covering ? 'overscroll-contain' : 'overscroll-x-contain') : '',
    endClearance: phone && covering ? PHONE_END_CLEARANCE : '',
  };
}

// The quick filter the board applies: none on a phone, where the widgets that set it are not shown, so a filter set on
// a wider screen never hides cards with nothing on screen to say so.
export function shownQuick(quick: QuickFilter, phone: boolean): QuickFilter {
  return phone ? NO_QUICK : quick;
}

// How long a finger holds a card still, on a phone board that shows one column a screen, before it may carry it
// (blueprint DEFAULTS): shorter than the long press that opens its menu (LONG_PRESS_MS, 500 ms), long enough that a
// swipe starting on a card scrolls.
export const CARD_HOLD_TO_DRAG_MS = 250;

// Where a held-to-drag press on a card stands as the finger moves: still within its hold ('wait'), moved off before
// the hold was up so it is a scroll, never a drag or a click ('scroll'), or held long enough to carry ('carry').
export function holdPhase(
  holdUntil: number,
  now: number,
  moved: boolean,
): 'wait' | 'scroll' | 'carry' {
  if (now >= holdUntil) return 'carry';
  return moved ? 'scroll' : 'wait';
}

// What keeps its own tap on a board: a card, and any control.
const OWN_TAP =
  '[data-plan-card], button, a, input, select, textarea, label, [role="button"], [role="dialog"], [contenteditable]';

// The column a tap on a phone board's empty space lands in (its cell background, between and below its cards, or its
// header outside the cog), or null when the tap is on a card or a control, or outside every column.
export function tappedColumn(target: Element | null, columnAttr: string): string | null {
  if (!target || target.closest(OWN_TAP)) return null;
  return target.closest(`[${columnAttr}]`)?.getAttribute(columnAttr) ?? null;
}

// The body's scrollLeft that puts a column's centre at the centre of the body's view; never past either end.
export function centredScrollLeft(
  body: { left: number; scrollLeft: number; clientWidth: number; scrollWidth: number },
  column: { left: number; width: number },
): number {
  const want =
    body.scrollLeft + column.left + column.width / 2 - (body.left + body.clientWidth / 2);
  return Math.max(0, Math.min(Math.round(want), body.scrollWidth - body.clientWidth));
}

// A tap on a column's empty space glides that column to the centre: across only (no top given, so the board never
// moves up or down), and a jump under reduced motion.
export function centreTappedColumn(
  target: Element | null,
  body: HTMLElement,
  columnAttr: string,
): boolean {
  const id = tappedColumn(target, columnAttr);
  if (id === null) return false;
  const head = body.querySelector(`[${columnAttr}="${CSS.escape(id)}"]`);
  if (!head) return false;
  const b = body.getBoundingClientRect();
  const c = head.getBoundingClientRect();
  const left = centredScrollLeft(
    {
      left: b.left + body.clientLeft,
      scrollLeft: body.scrollLeft,
      clientWidth: body.clientWidth,
      scrollWidth: body.scrollWidth,
    },
    { left: c.left, width: c.width },
  );
  if (left === body.scrollLeft) return true;
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  body.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' });
  return true;
}
