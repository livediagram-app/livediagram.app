// How far the Toolbar layout's top strip, and what stands under it, reaches down over the canvas: a page framed in
// a Pages editor (usePagesMode) centres below it, so its header (the page name and its Style, Layout and Background
// bar) is never under the strip or the palette tray.
// The palette tray counts while a standing message is on the page (a template's example content,
// liveworkspace/docs/specs/002-architecture/blueprints/template-examples.md). While a mode's message stands in its
// place (the modifier hint as Shift+1 is pressed), that message's box counts instead, so a fit made then still clears
// the slot. Without a standing message a mode's passing message gets no room, or every press would reframe the page.
// Once a page is framed with the tray's room, a page settling as the view rests keeps that room after the tray goes
// (Clear Example Content, Keep It): the page does not jump up under the pointer. The next explicit frame (Fit,
// Shift+1, a page's label, landing) reclaims it.

// The Toolbar layout's strip lies over the canvas's top edge.
const TOP_STRIP_SELECTOR = '[data-toolbar-palette]:not(.hidden)';

/** A standing palette tray (under the strip, or the top-centre pill without one). */
export const STANDING_TRAY_SELECTOR = '[data-palette-tray][data-yields-to-mode]';
// Any palette tray: the standing one, or a mode's message standing in its slot while it yields.
const ANY_TRAY_SELECTOR = '[data-palette-tray]';

// The tray's room (below the strip) each canvas was last framed with, held while pages settle.
const heldTrayRoom = new WeakMap<HTMLElement, number>();

export type TopStripInsetOptions = {
  /** Selectors for what stands under the strip (livedesign's photo options), counted only with the strip shown. */
  under?: readonly string[];
  /** A page settling as the view rests, not an explicit frame: keeps the tray's room it was framed with. */
  settling?: boolean;
};

/** How far a top strip laid over the canvas, and anything standing under it, reaches down into it, in screen px; 0
 *  with none in the canvas's top half. */
export function topStripInset(
  canvas: HTMLElement,
  { under = [], settling = false }: TopStripInsetOptions = {},
): number {
  const c = canvas.getBoundingClientRect();
  const upperHalf = (r: DOMRect) =>
    r.height > 0 && r.bottom > c.top && r.top < c.top + c.height / 2;
  let bottom = c.top;
  const strip = document.querySelector<HTMLElement>(TOP_STRIP_SELECTOR);
  // Stood aside (a phone's page toolbar in its place): its room is the page's.
  const stripShows = !!strip && getComputedStyle(strip).visibility !== 'hidden';
  if (stripShows) {
    const s = strip.getBoundingClientRect();
    if (upperHalf(s)) bottom = s.bottom;
    // What stands under the strip counts only with the strip over the canvas (a photo page's options flyout).
    for (const selector of under) {
      const r = document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
      if (r && bottom > c.top && upperHalf(r)) bottom = Math.max(bottom, r.bottom);
    }
  }
  const stripInset = bottom - c.top;
  // The standing tray, or the mode's message in its slot while it yields.
  let trayBottom = bottom;
  const standing = document.querySelector(STANDING_TRAY_SELECTOR) !== null;
  if (standing) {
    for (const tray of document.querySelectorAll<HTMLElement>(ANY_TRAY_SELECTOR)) {
      const r = tray.getBoundingClientRect();
      if (upperHalf(r)) trayBottom = Math.max(trayBottom, r.bottom);
    }
  }
  const fresh = trayBottom - bottom;
  // Settling with no tray box on screen (gone, or stepped aside for the Explorer) keeps the room it was framed with.
  const room = settling && fresh === 0 ? (heldTrayRoom.get(canvas) ?? 0) : fresh;
  heldTrayRoom.set(canvas, room);
  return stripInset + room;
}
