// How far the Toolbar layout's top strip, and what stands under it, reaches down over the canvas: a page framed in
// a Pages editor (usePagesMode) or a board column (frame-board-column.ts) centres below it, so its header (the page
// name and its Style, Layout and Background bar) is never under the strip or the palette tray.
// The palette tray counts only while a standing message shows (a template's example content,
// liveworkspace/docs/specs/002-architecture/blueprints/template-examples.md): a mode's passing message is not given
// room, or every press would reframe the page.

// The Toolbar layout's strip lies over the canvas's top edge.
const TOP_STRIP_SELECTOR = '[data-toolbar-palette]:not(.hidden)';

/** A standing palette tray (under the strip, or the top-centre pill without one): the room it takes is the page's
 *  to keep clear of. */
export const STANDING_TRAY_SELECTOR = '[data-palette-tray][data-yields-to-mode]';

/** How far a top strip laid over the canvas, and anything standing under it (`under`: selectors such as livedesign's
 *  photo options, plus a standing palette tray), reaches down into it, in screen px; 0 with none in the canvas's top
 *  half. */
export function topStripInset(canvas: HTMLElement, under: readonly string[] = []): number {
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
  // The standing tray: under the strip, or the top-centre pill when there is no strip.
  for (const tray of document.querySelectorAll<HTMLElement>(STANDING_TRAY_SELECTOR)) {
    const r = tray.getBoundingClientRect();
    if (upperHalf(r)) bottom = Math.max(bottom, r.bottom);
  }
  return bottom - c.top;
}
