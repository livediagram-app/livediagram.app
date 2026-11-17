// How far the Toolbar layout's top strip, and what stands under it, reaches down over the canvas: the shared measure
// (workbench's lib/top-strip-inset, which also keeps a standing palette tray's room), which a page (usePagesMode)
// framed on screen centres below.
import { topStripInset as sharedTopStripInset } from '@liveworkspace/workbench/lib/top-strip-inset';

// A photo page keeps a strip's height of room under the strip (docs/specs/031-photo/photo-pages.md "The options
// flyout"): the page centres below it too.
const UNDER_STRIP_SELECTOR = '[data-photo-options]';

/** How far a top strip laid over the canvas, and what stands under it, reaches down into it, in screen px.
 *  `settling`: a page settling as the view rests keeps the tray's room it was framed with. */
export function topStripInset(canvas: HTMLElement, settling = false): number {
  return sharedTopStripInset(canvas, { under: [UNDER_STRIP_SELECTOR], settling });
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
