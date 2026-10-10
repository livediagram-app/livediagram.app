// Mirror While Drawing's symmetry (docs/specs/007-editor/logo-pages.md "Mirror"): the ways a
// drawing on a logo page repeats about the artboard's centre (across its vertical centre line, its
// horizontal one, both, or turned round its centre a number of times), as plain affine maps, and
// a drawing's twins under them. A stroke's or a path's points are mapped (any rotation baked in);
// a shape is moved and turned. Pure: the caller gives each twin its own id.
import type { BoxedElement } from './index';
import type { FreehandElement, PathElement } from './element-types';
import { freehandCanvasPoints, freehandStrokePoints } from './freehand-points';
import { encodeStrokePoints } from './stroke-points';
import { pathContours, pathOfContours, pathWorldAnchors } from './path-element';
import type { PathAnchor } from './path-geometry';
import type { LaidOutPage, PageRect } from './illustrate-page';
import { MIRROR_AXIS_TOLERANCE } from './element-mirror';
import type { GuideLine } from './logo-page';

export type MirrorAxis = 'vertical' | 'horizontal' | 'both' | 'radial';

export type MirrorSettings = {
  axis: MirrorAxis;
  // How many times a radial drawing appears in all, the drawing itself included.
  copies: number;
  // Whether a drawing and its twins become one element on release (else they stay separate).
  merge: boolean;
};

export const MIRROR_AXES: readonly { id: MirrorAxis; label: string }[] = [
  { id: 'vertical', label: 'Vertical' },
  { id: 'horizontal', label: 'Horizontal' },
  { id: 'both', label: 'Both' },
  { id: 'radial', label: 'Radial' },
];
// A radial drawing's choices of copies: a triangle's turn up to an octagon's.
export const RADIAL_COPIES: readonly number[] = [3, 4, 5, 6, 8];
export const DEFAULT_MIRROR: MirrorSettings = { axis: 'vertical', copies: 6, merge: true };

/** A logo page Mirror While Drawing is on for, with its settings. */
export type MirroredPage = LaidOutPage & { mirror: MirrorSettings };

/** The logo pages in `mirrored`, each with its settings: what a drawing's twins are made on. */
export function withMirrorSettings(
  pages: readonly LaidOutPage[],
  mirrored: ReadonlyMap<string, MirrorSettings>,
): MirroredPage[] {
  const out: MirroredPage[] = [];
  for (const p of pages) {
    const mirror = mirrored.get(p.id);
    if (mirror && p.kind === 'logo') out.push({ ...p, mirror });
  }
  return out;
}

/** A point map `x' = a·x + c·y + e`, `y' = b·x + d·y + f` (CSS `matrix(a, b, c, d, e, f)`), with
 *  what it does to a shape's turn. */
export type SymmetryMap = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  // A shape's rotation (degrees) after the map: reflections flip it, turns add to it.
  turn: (rotation: number) => number;
};

const reflectV = (axisX: number): SymmetryMap => ({
  a: -1,
  b: 0,
  c: 0,
  d: 1,
  e: 2 * axisX,
  f: 0,
  turn: (r) => -r,
});
// A shape cannot flip upside down: for the left-right symmetric shapes a turn of half round
// beside its reflection does.
const reflectH = (axisY: number): SymmetryMap => ({
  a: 1,
  b: 0,
  c: 0,
  d: -1,
  e: 0,
  f: 2 * axisY,
  turn: (r) => 180 - r,
});
function turnAbout(cx: number, cy: number, deg: number): SymmetryMap {
  const t = (deg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  // Clockwise on screen (y down), as an element's rotation turns.
  return {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: cx - cos * cx + sin * cy,
    f: cy - sin * cx - cos * cy,
    turn: (r) => r + deg,
  };
}

/** The maps a drawing on a page of `rect` repeats under, the drawing's own place left out. */
export function symmetryMaps(rect: PageRect, settings: MirrorSettings): SymmetryMap[] {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  switch (settings.axis) {
    case 'vertical':
      return [reflectV(cx)];
    case 'horizontal':
      return [reflectH(cy)];
    case 'both':
      return [reflectV(cx), reflectH(cy), turnAbout(cx, cy, 180)];
    case 'radial': {
      const n = Math.max(2, Math.round(settings.copies));
      return Array.from({ length: n - 1 }, (_, i) => turnAbout(cx, cy, ((i + 1) * 360) / n));
    }
  }
}

export const mapPoint = (m: SymmetryMap, p: { x: number; y: number }) => ({
  x: m.a * p.x + m.c * p.y + m.e,
  y: m.b * p.x + m.d * p.y + m.f,
});

// A point turned by `deg` about (cx, cy).
function rotated(p: { x: number; y: number }, cx: number, cy: number, deg: number) {
  if (deg % 360 === 0) return p;
  const t = (deg * Math.PI) / 180;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return {
    x: cx + dx * Math.cos(t) - dy * Math.sin(t),
    y: cy + dx * Math.sin(t) + dy * Math.cos(t),
  };
}

function mapFreehand(el: FreehandElement, m: SymmetryMap): FreehandElement {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const pts = freehandCanvasPoints(el).map((p) =>
    mapPoint(m, rotated(p, cx, cy, el.rotation ?? 0)),
  );
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  const width = Math.max(1, x1 - x0);
  const height = Math.max(1, y1 - y0);
  const pressures = freehandStrokePoints(el).pressures;
  const { rotation: _turn, ...rest } = el;
  return {
    ...rest,
    x: x0,
    y: y0,
    width,
    height,
    packedPoints: encodeStrokePoints(
      pts.map((p) => ({ nx: (p.x - x0) / width, ny: (p.y - y0) / height })),
      pressures ? Array.from(pressures) : undefined,
    ),
  };
}

function mapPath(el: PathElement, m: SymmetryMap): PathElement {
  const at = (p: { x: number; y: number }) => mapPoint(m, p);
  const contours = pathContours(el).map((nodes) =>
    pathWorldAnchors(el, nodes).map((a): PathAnchor => ({
      x: at(a).x,
      y: at(a).y,
      mode: a.mode,
      ...(a.handleIn ? { handleIn: at(a.handleIn) } : {}),
      ...(a.handleOut ? { handleOut: at(a.handleOut) } : {}),
    })),
  );
  const {
    x: _x,
    y: _y,
    width: _w,
    height: _h,
    nodes: _n,
    subpaths: _s,
    rotation: _r,
    ...base
  } = el;
  return pathOfContours(base, contours);
}

/** The element under `m` (same id): points mapped for a stroke or a path, else its box moved so
 *  its centre maps and its turn follows (`m.turn`). */
export function mapElement<T extends BoxedElement>(el: T, m: SymmetryMap): T {
  if (el.type === 'freehand') return mapFreehand(el, m) as T;
  if (el.type === 'path') return mapPath(el, m) as T;
  const c = mapPoint(m, { x: el.x + el.width / 2, y: el.y + el.height / 2 });
  const turned = ((m.turn((el as { rotation?: number }).rotation ?? 0) % 360) + 360) % 360;
  return {
    ...el,
    x: c.x - el.width / 2,
    y: c.y - el.height / 2,
    ...(turned === 0 ? { rotation: undefined } : { rotation: turned }),
  } as T;
}

/** The lines a page's mirror is drawn as: a centre line per reflection, and for a radial mirror a
 *  spoke from the centre to the page's edge at each copy, the first straight up. */
export function mirrorAxisLines(rect: PageRect, settings: MirrorSettings): GuideLine[] {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const v = { x1: cx, y1: rect.y, x2: cx, y2: rect.y + rect.height };
  const h = { x1: rect.x, y1: cy, x2: rect.x + rect.width, y2: cy };
  switch (settings.axis) {
    case 'vertical':
      return [v];
    case 'horizontal':
      return [h];
    case 'both':
      return [v, h];
    case 'radial': {
      const n = Math.max(2, Math.round(settings.copies));
      const reach = Math.min(rect.width, rect.height) / 2;
      return Array.from({ length: n }, (_, i) => {
        const t = ((i * 360) / n - 90) * (Math.PI / 180);
        return { x1: cx, y1: cy, x2: cx + reach * Math.cos(t), y2: cy + reach * Math.sin(t) };
      });
    }
  }
}

/** The mirrored page a box drawn here is on (by its centre), or null. */
export function mirroredPageAt(
  pages: readonly MirroredPage[],
  point: { x: number; y: number },
): MirroredPage | null {
  return (
    pages.find(
      (p) =>
        point.x >= p.rect.x &&
        point.x <= p.rect.x + p.rect.width &&
        point.y >= p.rect.y &&
        point.y <= p.rect.y + p.rect.height,
    ) ?? null
  );
}

/** The maps a box drawn here repeats under: its mirrored page's, less any that would lay a copy on
 *  the box itself (its centre on the axis, or at the centre a turn is about). Empty off one.
 *  Shared by the twins a release adds and the twins previewed while drawing, so the two agree. */
export function symmetryMapsFor(
  pages: readonly MirroredPage[],
  box: { x: number; y: number; width: number; height: number },
): SymmetryMap[] {
  const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const page = mirroredPageAt(pages, c);
  if (!page) return [];
  // A reflection moves a centre twice its distance from the axis.
  const reach = 2 * MIRROR_AXIS_TOLERANCE * page.rect.width;
  return symmetryMaps(page.rect, page.mirror).filter((m) => {
    const to = mapPoint(m, c);
    return Math.hypot(to.x - c.x, to.y - c.y) > reach;
  });
}

/** The twins a drawn element gets (a stroke, a path or a shape), none off a mirrored page. */
export function symmetryTwins(el: BoxedElement, pages: readonly MirroredPage[]): BoxedElement[] {
  if (el.type !== 'freehand' && el.type !== 'path' && el.type !== 'shape') return [];
  return symmetryMapsFor(pages, el).map((m) => mapElement(el, m));
}
