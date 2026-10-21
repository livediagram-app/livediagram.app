// The view rests on a page (docs/specs/007-editor/pages-mode.md "Getting around the pages"): once a
// pan or a zoom lets go, which page the view lands on and the frame it lands at. Never between
// pages, past the row, or zoomed out past a page; zoomed in further than fit stays zoomed in, the
// page kept across what shows. Pure: usePageSnap measures the canvas and hands it in.
import type { LaidOutPage } from '@liveplanner/document';
import { pageInView } from './page-contents';
import { READING_TOP_ROOM, type Offset } from './viewport';

export type SnapFrame = { zoom: number; offset: Offset };

/** What shows of the canvas, in screen px from its top-left: the canvas less the Toolbar strip
 *  over its top and the Contents sidebar at a side. */
export type SnapBand = { left: number; right: number; top: number; bottom: number };

// A zoom this close above a page's fit counts as the fit: a pinch that ends a hair past it is a
// page seen whole, not a zoom in.
export const SNAP_FIT_TOLERANCE = 1.02;
// From a page seen whole, a pan of this share of the band's width toward a neighbour turns to it.
export const SNAP_SWIPE_FRACTION = 0.2;
// A flick turns the page sooner: the content moving at least this fast (screen px per ms) as the
// hand lets go, after at least SNAP_FLICK_MIN_PX of travel.
export const SNAP_FLICK_PX_PER_MS = 0.5;
export const SNAP_FLICK_MIN_PX = 24;
// How far inside the band a zoomed-in page's edge may rest: the reading frame's own top room, so
// an article page read on a phone never moves when the finger lets go.
export const SNAP_EDGE_ROOM = READING_TOP_ROOM;

export type PageSnap = {
  pageId: string;
  frame: SnapFrame;
  // The page turned by a short pan or flick rather than lying under the view's middle.
  swiped: boolean;
};

/**
 * The frame the view should glide to, or null when it already rests on a page.
 * `fitOf` is the page's own fit (as its label frames it); `from` the page in view as the gesture
 * began; `velocity` the content's sideways speed (screen px per ms) as a pan let go, given only for
 * a pan, so a pinch or a zoom never turns the page.
 */
export function pageSnap(input: {
  pages: readonly LaidOutPage[];
  view: SnapFrame;
  screen: { width: number; height: number };
  band: SnapBand;
  fitOf: (page: LaidOutPage) => SnapFrame;
  from?: string;
  velocity?: number;
}): PageSnap | null {
  const { pages, view, screen, band, fitOf } = input;
  const hereId = pageInView(pages, view, screen, {
    left: band.left,
    right: screen.width - band.right,
  });
  let page = pages.find((p) => p.id === hereId);
  if (!page) return null;
  const turned = input.velocity === undefined ? undefined : swipeTurn(input, page);
  if (turned) page = turned;
  const fit = fitOf(page);
  // Moved on from a page seen whole (a swipe, or a pan onto another page): the new page is seen whole
  // too, at its own fit, however its zoom compares (a watch's fit is far closer than an article's).
  const start = input.from === undefined ? undefined : pages.find((p) => p.id === input.from);
  const movedOnWhole =
    !!start && start.id !== page.id && view.zoom <= fitOf(start).zoom * SNAP_FIT_TOLERANCE;
  const frame =
    turned || movedOnWhole || view.zoom <= fit.zoom * SNAP_FIT_TOLERANCE
      ? fit
      : {
          zoom: view.zoom,
          offset: {
            x: clampAxis(
              view.offset.x,
              view.zoom,
              screen.width,
              page.rect.x,
              page.rect.width,
              band.left,
              band.right,
            ),
            y: clampAxis(
              view.offset.y,
              view.zoom,
              screen.height,
              page.rect.y,
              page.rect.height,
              band.top,
              band.bottom,
            ),
          },
        };
  if (sameFrame(frame, view)) return null;
  return { pageId: page.id, frame, swiped: !!turned };
}

/** The neighbour a short pan or a flick from a page seen whole turns to, if it did. */
function swipeTurn(
  input: Parameters<typeof pageSnap>[0],
  here: LaidOutPage,
): LaidOutPage | undefined {
  const { pages, view, screen, band, fitOf, from, velocity = 0 } = input;
  const start = pages.find((p) => p.id === from);
  // Only from the page you were on, still under the middle: a long pan onto another page lands
  // there by itself.
  if (!start || start.id !== here.id || view.zoom > fitOf(start).zoom * SNAP_FIT_TOLERANCE) {
    return undefined;
  }
  // How far the band's middle sits right of the page's, in screen px: right means toward the next.
  const middle = (band.left + band.right) / 2;
  const pageMiddle =
    screen.width / 2 +
    view.zoom * (start.rect.x + start.rect.width / 2 + view.offset.x - screen.width / 2);
  const travel = middle - pageMiddle;
  const dir = Math.sign(travel);
  if (dir === 0) return undefined;
  const far = Math.abs(travel) >= SNAP_SWIPE_FRACTION * (band.right - band.left);
  // The content moving left (negative) carries the view toward the next page.
  const flick =
    Math.abs(travel) >= SNAP_FLICK_MIN_PX &&
    Math.abs(velocity) >= SNAP_FLICK_PX_PER_MS &&
    Math.sign(-velocity) === dir;
  if (!far && !flick) return undefined;
  return pages[pages.indexOf(start) + dir];
}

/** One axis of a zoomed-in page held across the band: its offset moved so the page, `len` canvas
 *  px from `start`, covers the band (an edge at most SNAP_EDGE_ROOM inside), or centres in it
 *  when narrower. With the centred transform a canvas x lands at `size/2 + zoom(x + offset - size/2)`. */
export function clampAxis(
  offset: number,
  zoom: number,
  size: number,
  start: number,
  len: number,
  bandStart: number,
  bandEnd: number,
): number {
  const at = size / 2 + zoom * (start + offset - size / 2);
  const span = zoom * len;
  const room = bandEnd - bandStart;
  const want =
    span <= room - 2 * SNAP_EDGE_ROOM
      ? bandStart + (room - span) / 2
      : Math.min(bandStart + SNAP_EDGE_ROOM, Math.max(bandEnd - SNAP_EDGE_ROOM - span, at));
  return offset + (want - at) / zoom;
}

// Within half a screen pixel and a hair of zoom: already resting there.
function sameFrame(a: SnapFrame, b: SnapFrame): boolean {
  return (
    Math.abs(a.zoom - b.zoom) <= 1e-4 * b.zoom &&
    Math.abs(a.offset.x - b.offset.x) * b.zoom < 0.5 &&
    Math.abs(a.offset.y - b.offset.y) * b.zoom < 0.5
  );
}
