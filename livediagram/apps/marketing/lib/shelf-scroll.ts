// The template gallery's opened shelf brought into view (docs/specs/019-marketing/marketing-site.md
// "Template gallery"): the open shelf sits above the category cards, so a card pressed lower down
// opens a row that can be scrolled out of sight above, and the press looks like it did nothing.
// Pure: TemplateGallery measures the shelf and scrolls.

// The site header's height (SiteHeader's h-18): what covers the viewport's top.
export const SHELF_SCROLL_TOP_INSET = 72;
// The room kept above the shelf's heading once it is scrolled to.
export const SHELF_SCROLL_GAP = 16;

/** Where to scroll the window to show the shelf whole, or null when it already shows: its top
 *  below the header and its bottom on screen (a shelf taller than the screen counts once its top
 *  shows). `rect` is the shelf's bounding rect, `scrollY` the window's scroll now. */
export function shelfScrollTarget(
  rect: { top: number; bottom: number },
  viewportHeight: number,
  scrollY: number,
): number | null {
  const top = SHELF_SCROLL_TOP_INSET;
  const tall = rect.bottom - rect.top > viewportHeight - top;
  const shows =
    rect.top >= top && (rect.bottom <= viewportHeight || (tall && rect.top < viewportHeight));
  if (shows) return null;
  return Math.max(0, scrollY + rect.top - top - SHELF_SCROLL_GAP);
}
