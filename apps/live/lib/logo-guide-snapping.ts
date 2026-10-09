// Drawing onto a logo page's construction guides (docs/specs/007-editor/logo-pages.md "Construction
// guides"): while the guides show, a Pen click and a stroke's start and end land on a guide within a
// few screen px of it (snapToLogoGuides). Pure; the editor hands in its pages, guide choices and zoom.
import {
  freehandCanvasPoints,
  freehandPressures,
  logoGuides,
  logoPageAt,
  packFreehandPoints,
  logoGuideSnapTargets,
  snapToGuideTargets,
  type Element,
  type LaidOutPage,
  type LogoGuideSnapPart,
  type LogoGuideSnapTargets,
} from '@livediagram/document';

type Point = { x: number; y: number };

/** How near a guide, in screen px, a point is pulled onto it. */
export const LOGO_GUIDE_SNAP_PX = 8;
// A stroke's end moved onto a guide carries the samples nearest it part of the way, fading over
// this many, so the line bends onto the guide rather than kinking.
const STROKE_EASE_SAMPLES = 8;

/** Snaps a canvas point to the shown guides of the logo page under it, else null. */
export type GuideSnap = (p: Point, zoom: number) => Point | null;

export function logoGuideSnapper(
  pages: readonly LaidOutPage[] | null,
  guides: { on: boolean; parts: ReadonlySet<LogoGuideSnapPart> },
): GuideSnap | null {
  if (!pages || !guides.on) return null;
  // Each page's guides prepared on its first snap and kept (the snapper is rebuilt when the pages
  // or the guide choices change), so a snap per frame is a scan of points.
  const prepared = new Map<string, LogoGuideSnapTargets>();
  return (p, zoom) => {
    const page = logoPageAt(pages, p);
    if (!page) return null;
    let targets = prepared.get(page.id);
    if (!targets) {
      targets = logoGuideSnapTargets(logoGuides(page.rect), (part) => guides.parts.has(part));
      prepared.set(page.id, targets);
    }
    return snapToGuideTargets(targets, p, LOGO_GUIDE_SNAP_PX / zoom);
  };
}

// The points with one end moved to `to`, the move fading over the samples after it.
function easeEnd(pts: Point[], fromStart: boolean, to: Point): Point[] {
  const n = pts.length;
  const end = fromStart ? 0 : n - 1;
  const dx = to.x - pts[end]!.x;
  const dy = to.y - pts[end]!.y;
  const span = Math.min(STROKE_EASE_SAMPLES, n - 1);
  return pts.map((p, i) => {
    const k = fromStart ? i : n - 1 - i;
    if (k >= span && k !== 0) return p;
    const w = span === 0 ? 1 : 1 - k / span;
    return { x: p.x + dx * w, y: p.y + dy * w };
  });
}

/** `next` with each stroke it newly adds (an open pencil or marker line) starting and ending on a
 *  guide where it began or finished near one. */
export function snapNewStrokes(
  before: readonly Element[],
  next: Element[],
  snap: GuideSnap | null,
  zoom: number,
): Element[] {
  if (!snap || next === before) return next;
  const had = new Set(before.map((el) => el.id));
  let changed = false;
  const out = next.map((el) => {
    if (had.has(el.id) || el.type !== 'freehand' || el.closed || el.rotation) return el;
    // The highlighter marks over the artwork; only a pencil or marker line starts on a guide.
    if (el.pen === 'highlighter') return el;
    let pts = freehandCanvasPoints(el);
    if (pts.length < 2) return el;
    const start = snap(pts[0]!, zoom);
    if (start) pts = easeEnd(pts, true, start);
    const end = snap(pts[pts.length - 1]!, zoom);
    if (end) pts = easeEnd(pts, false, end);
    if (!start && !end) return el;
    changed = true;
    return { ...el, ...packFreehandPoints(pts, freehandPressures(el)) };
  });
  return changed ? out : next;
}

/** How near a guide, in screen px, Tidy Up pulls a corner or a straight run onto it: further than
 *  drawing does, since tidying is asked for. */
export const TIDY_GUIDE_PX = 16;

/** What Tidy Up aligns a drawing to on a logo page: a corner onto the shown guides, and a level or
 *  upright run onto the nearest horizontal or vertical guide (a centre line, a grid line, a safe
 *  area or keyline square edge). Each null when nothing is near enough. */
export type TidyGuides = {
  point: (p: Point) => Point | null;
  // A level run at height `y` (or an upright one at `x`), near the canvas point `near`.
  y: (y: number, near: Point) => number | null;
  x: (x: number, near: Point) => number | null;
};

export function logoTidyGuides(
  pages: readonly LaidOutPage[] | null,
  parts: ReadonlySet<LogoGuideSnapPart>,
  zoom: number,
): TidyGuides | null {
  if (!pages?.length) return null;
  const radius = TIDY_GUIDE_PX / zoom;
  const prepared = new Map<string, LogoGuideSnapTargets>();
  const targetsAt = (p: Point) => {
    const page = logoPageAt(pages, p);
    if (!page) return null;
    let t = prepared.get(page.id);
    if (!t) {
      t = logoGuideSnapTargets(logoGuides(page.rect), (part) => parts.has(part));
      prepared.set(page.id, t);
    }
    return t;
  };
  // The nearest of `values` to `v` within the radius.
  const nearest = (v: number, values: number[]) => {
    let best: number | null = null;
    for (const c of values) {
      if (Math.abs(c - v) <= radius && (best === null || Math.abs(c - v) < Math.abs(best - v)))
        best = c;
    }
    return best;
  };
  return {
    point: (p) => {
      const t = targetsAt(p);
      return t ? snapToGuideTargets(t, p, radius) : null;
    },
    y: (y, near) => {
      const t = targetsAt(near);
      return t
        ? nearest(
            y,
            t.lines.filter((l) => l.y1 === l.y2).map((l) => l.y1),
          )
        : null;
    },
    x: (x, near) => {
      const t = targetsAt(near);
      return t
        ? nearest(
            x,
            t.lines.filter((l) => l.x1 === l.x2).map((l) => l.x1),
          )
        : null;
    },
  };
}
