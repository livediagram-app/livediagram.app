// A path element and its anchors (docs/specs/023-whiteboard/path-tool.md "The path element"): the
// element stores its nodes normalised to a box that wraps the drawn curve; every gesture works on
// anchors in canvas px and hands them back through `pathGeometry`.
import type { PathElement, PathNode, PathPoint } from './element-types';
import type { Point } from './geometry-primitives';
import { pathBounds, type PathAnchor } from './path-geometry';

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

/** The nodes where they show on screen: turned by the element's rotation about its centre. */
export function pathWorldAnchors(el: PathElement): PathAnchor[] {
  const anchors = pathAnchors(el);
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
 * A continued path (docs/specs/023-whiteboard/path-tool.md "Drawing"): the same element with the
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
