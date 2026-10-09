// A path element and its anchors (docs/specs/023-draw-mode/path-tool.md "The path element"): the
// element stores its nodes normalised to a box that wraps the drawn curve; every gesture works on
// anchors in canvas px and hands them back through `pathGeometry`.
import type { PathElement, PathNode, PathPoint } from './element-types';
import type { Point } from './geometry-primitives';
import { pathBounds, pathD, type PathAnchor } from './path-geometry';

export type PathGeometry = Pick<PathElement, 'x' | 'y' | 'width' | 'height' | 'nodes'>;

// A straight horizontal or vertical path still needs a dimension to normalise against.
const MIN_PATH_BOX = 1;

type PathShape = Pick<PathElement, 'x' | 'y' | 'width' | 'height' | 'nodes'>;

/** The element's nodes in canvas px (unrotated), or relative to `origin` as its top-left. */
export function pathAnchors(el: PathShape, origin?: Point): PathAnchor[] {
  const ox = origin?.x ?? el.x;
  const oy = origin?.y ?? el.y;
  const w = Math.max(el.width, MIN_PATH_BOX);
  const h = Math.max(el.height, MIN_PATH_BOX);
  const px = (p: PathPoint): Point => ({ x: ox + p.nx * w, y: oy + p.ny * h });
  return el.nodes.map((n) => {
    const anchor: PathAnchor = { ...px(n), mode: n.mode };
    if (n.handleIn) anchor.handleIn = px(n.handleIn);
    if (n.handleOut) anchor.handleOut = px(n.handleOut);
    return anchor;
  });
}

/** Every contour of a path: its nodes, then a combined shape's further contours. */
export function pathContours(el: Pick<PathElement, 'nodes' | 'subpaths'>): PathNode[][] {
  return el.subpaths?.length ? [el.nodes, ...el.subpaths] : [el.nodes];
}

/** A path of several contours given in canvas px (each a list of anchors), the box wrapping them
 *  all and every contour normalised to it: `base` gives the rest of the element (id, style). */
export function pathOfContours(
  base: Omit<PathElement, 'x' | 'y' | 'width' | 'height' | 'nodes' | 'subpaths'>,
  contours: readonly (readonly PathAnchor[])[],
): PathElement {
  const boxes = contours.map((c) => pathBounds(c, base.closed));
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.width));
  const y1 = Math.max(...boxes.map((b) => b.y + b.height));
  const width = Math.max(MIN_PATH_BOX, x1 - x0);
  const height = Math.max(MIN_PATH_BOX, y1 - y0);
  const norm = (p: Point): PathPoint => ({ nx: (p.x - x0) / width, ny: (p.y - y0) / height });
  const [first, ...rest] = contours.map((c) =>
    c.map((a) => {
      const node: PathNode = { ...norm(a), mode: a.mode };
      if (a.handleIn) node.handleIn = norm(a.handleIn);
      if (a.handleOut) node.handleOut = norm(a.handleOut);
      return node;
    }),
  );
  return {
    ...base,
    x: x0,
    y: y0,
    width,
    height,
    nodes: first ?? [],
    ...(rest.length ? { subpaths: rest } : {}),
  } as PathElement;
}

/** Whether the path is a combined shape of several contours (docs/specs/007-editor/logo-pages.md
 *  "Combine"): filled even-odd, edited as a whole. */
export function isCompoundPath(el: Pick<PathElement, 'subpaths'>): boolean {
  return (el.subpaths?.length ?? 0) > 0;
}

/** The SVG path data of every contour, in canvas px or relative to `origin`. */
export function pathElementD(
  el: PathShape & Pick<PathElement, 'closed' | 'subpaths'>,
  origin?: Point,
  fmt?: (n: number) => number,
): string {
  return pathContours(el)
    .map((nodes) => pathD(pathAnchors({ ...el, nodes }, origin), el.closed, fmt))
    .join(' ');
}

/** The box of the drawn curve (at least 1 px each way) and the nodes normalised inside it. */
export function pathGeometry(anchors: readonly PathAnchor[], closed: boolean): PathGeometry {
  if (anchors.length === 0) return { x: 0, y: 0, width: 1, height: 1, nodes: [] };
  const b = pathBounds(anchors, closed);
  const width = Math.max(MIN_PATH_BOX, b.width);
  const height = Math.max(MIN_PATH_BOX, b.height);
  const x = b.x - (width - b.width) / 2;
  const y = b.y - (height - b.height) / 2;
  const norm = (p: Point): PathPoint => ({ nx: (p.x - x) / width, ny: (p.y - y) / height });
  const nodes = anchors.map((a) => {
    const node: PathNode = { ...norm(a), mode: a.mode };
    if (a.handleIn) node.handleIn = norm(a.handleIn);
    if (a.handleOut) node.handleOut = norm(a.handleOut);
    return node;
  });
  return { x, y, width, height, nodes };
}

/** A new, unpainted path: drawn in the board's ink (or the theme's stroke), unfilled. */
export function createPath(anchors: readonly PathAnchor[], closed: boolean): PathElement {
  return { id: crypto.randomUUID(), type: 'path', ...pathGeometry(anchors, closed), closed };
}

/**
 * The element with new anchors (in its own unrotated frame), every other field kept. A rotated
 * path's box moves so the rotation about the new centre leaves every node where it showed.
 */
export function reshapePath(
  el: PathElement,
  anchors: readonly PathAnchor[],
  closed: boolean,
): PathElement {
  const g = pathGeometry(anchors, closed);
  const rotation = el.rotation ?? 0;
  if (rotation % 360 === 0) return { ...el, ...g, closed };
  const r = (rotation * Math.PI) / 180;
  const dx = el.x + el.width / 2 - (g.x + g.width / 2);
  const dy = el.y + el.height / 2 - (g.y + g.height / 2);
  // t = (c − c′) − R(c − c′)
  const tx = dx - (dx * Math.cos(r) - dy * Math.sin(r));
  const ty = dy - (dx * Math.sin(r) + dy * Math.cos(r));
  return { ...el, ...g, x: g.x + tx, y: g.y + ty, closed };
}

const turn = (p: Point, c: Point, cos: number, sin: number): Point => ({
  x: c.x + (p.x - c.x) * cos - (p.y - c.y) * sin,
  y: c.y + (p.x - c.x) * sin + (p.y - c.y) * cos,
});

/** The nodes where they show on screen: turned by the element's rotation about its centre. A
 *  combined shape's further contour is given as `nodes`. */
export function pathWorldAnchors(el: PathElement, nodes: PathNode[] = el.nodes): PathAnchor[] {
  const anchors = pathAnchors({ ...el, nodes });
  const rotation = el.rotation ?? 0;
  if (rotation % 360 === 0) return anchors;
  const r = (rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const c = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
  return anchors.map((a) => {
    const out: PathAnchor = { ...turn(a, c, cos, sin), mode: a.mode };
    if (a.handleIn) out.handleIn = turn(a.handleIn, c, cos, sin);
    if (a.handleOut) out.handleOut = turn(a.handleOut, c, cos, sin);
    return out;
  });
}

/**
 * A continued path (docs/specs/023-draw-mode/path-tool.md "Drawing"): the same element with the
 * drawn anchors, which are in world px, so any rotation is already in them and none is kept.
 */
export function continuedPath(
  el: PathElement,
  anchors: readonly PathAnchor[],
  closed: boolean,
): PathElement {
  const { rotation: _rotation, ...rest } = el;
  return { ...rest, ...pathGeometry(anchors, closed), closed };
}

/** The same path run the other way: each node's handles trade places. */
export function reversePath(anchors: readonly PathAnchor[]): PathAnchor[] {
  return [...anchors].reverse().map((a) => {
    const out: PathAnchor = { x: a.x, y: a.y, mode: a.mode };
    if (a.handleOut) out.handleIn = a.handleOut;
    if (a.handleIn) out.handleOut = a.handleIn;
    return out;
  });
}
