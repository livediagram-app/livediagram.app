// How far the Toolbar layout's top strip reaches down over the canvas: a page (usePagesMode) or a board
// column (frame-board-column.ts) framed on screen centres below it.
// The Toolbar layout's strip lies over the canvas's top edge; the page centres below it.
const TOP_STRIP_SELECTOR = '[data-toolbar-palette]:not(.hidden)';

// A photo page keeps a strip's height of room under the strip (docs/specs/031-photo/photo-pages.md "The options
// flyout"): the page centres below it too.
const UNDER_STRIP_SELECTOR = '[data-photo-options]';

/** How far a top strip laid over the canvas reaches down into it, in screen px. */
export function topStripInset(canvas: HTMLElement): number {
  const strip = document.querySelector<HTMLElement>(TOP_STRIP_SELECTOR);
  // Stood aside (a phone's page toolbar in its place): its room is the page's.
  if (!strip || getComputedStyle(strip).visibility === 'hidden') return 0;
  const c = canvas.getBoundingClientRect();
  const s = strip.getBoundingClientRect();
  const overlaps = s.bottom > c.top && s.top < c.top + c.height / 2;
  if (!overlaps) return 0;
  const under = document.querySelector<HTMLElement>(UNDER_STRIP_SELECTOR)?.getBoundingClientRect();
  const bottom =
    under && under.top < c.top + c.height / 2 ? Math.max(s.bottom, under.bottom) : s.bottom;
  return bottom - c.top;
}

// The bottom-right controls (undo, the pages strip, zoom: CanvasChrome's cluster).
const BOTTOM_CLUSTER_SELECTOR = '[data-zoom-cluster]';
// The room kept between a framed page's foot and the controls, px.
export const BOTTOM_CLUSTER_GAP = 12;

/** How far the bottom-right controls reach up into the canvas, plus a small gap, in screen px: what a page framed in
 *  Pages mode keeps clear (docs/specs/007-editor/pages-mode.md, "A page's label zooms to it"), so Fit never runs it under them.
 *  A whole, even number of px (the frame centres in the band above, moving the page by half of it); 0 with none. */
export function bottomClusterInset(canvas: HTMLElement): number {
  const cluster = document.querySelector<HTMLElement>(BOTTOM_CLUSTER_SELECTOR);
  if (!cluster) return 0;
  const c = canvas.getBoundingClientRect();
  const r = cluster.getBoundingClientRect();
  if (r.height <= 0 || r.top >= c.bottom || r.bottom <= c.top) return 0;
  return Math.ceil((Math.max(0, c.bottom - r.top) + BOTTOM_CLUSTER_GAP) / 2) * 2;
}
