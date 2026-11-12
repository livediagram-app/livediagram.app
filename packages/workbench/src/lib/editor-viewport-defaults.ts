// The constants every editor's useEditorViewport (hooks/canvas/useEditorViewport.ts) reads, and its view
// comparison: one copy for every editor (docs/specs/008-canvas/canvas-and-palette.md "Canvas"). The hooks
// themselves stay in each editor, whose views differ (livediagram's phone landing view, livehuddle's glide to
// the fit, the fit glides of livedesign, livedocuments and liveplanner).
import type { ViewPose } from './viewport-glide';

// Breakpoint at which we initialise the viewport at 60% zoom rather
// than 100%, so a mobile visitor lands on a usable overview instead
// of a single nodes-fill-the-screen view. 30% was too far out, the
// text on every element became unreadable; 60% keeps labels legible
// while still showing a workable chunk of canvas around the
// pointer. Deliberately wider than lib/responsive's MOBILE_BREAKPOINT_PX
// (640, the "dock the panels" line): tablets in the 640 to 768 band keep
// the desktop layout but still benefit from the zoomed-out overview, so
// this is its own constant rather than the shared one.
export const OVERVIEW_ZOOM_BREAKPOINT_PX = 768;
export const MOBILE_DEFAULT_ZOOM = 0.6;
export const DESKTOP_DEFAULT_ZOOM = 1;

// Screen-px margins kept clear when scrolling an element into view: room
// above for the selection toolbar + top chrome, below for the tab bar /
// dock, and a little on the sides.
export const VIEW_MARGIN_TOP = 96;
export const VIEW_MARGIN_BOTTOM = 88;
export const VIEW_MARGIN_SIDE = 20;

// When a new element is too big to fit the visible band at the current
// zoom, scrollIntoView zooms OUT (never in) so the WHOLE element shows.
// FIT_SAFETY leaves a sliver of padding inside the margins; MIN_FIT_ZOOM
// floors how far out we'll go for a very large element.
export const FIT_SAFETY = 0.95;
export const MIN_FIT_ZOOM = 0.2;

// Whether two views are the same, to the pixel a view is rounded to.
export function sameView(a: ViewPose, b: ViewPose): boolean {
  return (
    Math.abs(a.zoom - b.zoom) < 1e-3 &&
    Math.abs(a.offset.x - b.offset.x) <= 1 &&
    Math.abs(a.offset.y - b.offset.y) <= 1
  );
}
