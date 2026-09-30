// A path's edit mode (docs/specs/023-whiteboard/path-tool.md "Editing"; blueprint path-tool "Edit
// mode"): pure operations on its anchors, the hit test behind every press, and the rule for when
// the mode is open. The gesture (components/canvas/path/usePathEditGesture) owns the events and
// the commit. Anchors here are in the path's own unrotated frame, in canvas px.
import {
  bendSegment,
  constrain45,
  nearestOnPath,
  partnerHandle,
  pathSegments,
  smoothHandles,
  splitSegment,
  type Element,
  type PathAnchor,
  type PathElement,
} from '@livediagram/document';
import { STROKE_HIT_SCREEN_PX } from './whiteboard-tool';

type Point = { x: number; y: number };
export type HandleSide = 'in' | 'out';

// Screen px around a node or a handle that catches a press: a 24 x 24 target.
export const PATH_NODE_HIT_PX = 12;
// A finger's reach (docs/specs/023-whiteboard/path-tool.md "Touch"): the nearest node or handle
// within this many screen px.
export const PATH_TOUCH_HIT_PX = 16;
// Screen px within which a dragged node lines up with another node or its own start.
export const PATH_SNAP_PX = 8;

export type PathEditHit =
  | { kind: 'handle'; node: number; side: HandleSide }
  | { kind: 'node'; node: number }
  | { kind: 'segment'; segment: number; t: number }
  | { kind: 'empty' };

/** Edit mode is open when the element being edited is a path. */
export function isPathEditing(elements: readonly Element[], editingId: string | null): boolean {
  if (editingId === null) return false;
  return elements.some((el) => el.id === editingId && el.type === 'path');
}

const handleOf = (a: PathAnchor, side: HandleSide) => (side === 'in' ? a.handleIn : a.handleOut);

/** The handles edit mode shows: every selected node's, and its neighbours' facing sides. */
export function visibleHandles(
  anchors: readonly PathAnchor[],
  closed: boolean,
  selected: ReadonlySet<number>,
): { node: number; side: HandleSide }[] {
  const n = anchors.length;
  const out: { node: number; side: HandleSide }[] = [];
  const seen = new Set<string>();
  const add = (node: number, side: HandleSide) => {
    const key = `${node}:${side}`;
    if (seen.has(key) || !handleOf(anchors[node]!, side)) return;
    seen.add(key);
    out.push({ node, side });
  };
  for (const i of [...selected].sort((a, b) => a - b)) {
    if (i < 0 || i >= n) continue;
    add(i, 'in');
    add(i, 'out');
    const prev = i > 0 ? i - 1 : closed ? n - 1 : -1;
    const next = i < n - 1 ? i + 1 : closed ? 0 : -1;
    if (prev >= 0) add(prev, 'out');
    if (next >= 0) add(next, 'in');
  }
  return out;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** What a press at `p` lands on: a visible handle, a node, a segment, or empty space. */
export function pathEditHit(
  anchors: readonly PathAnchor[],
  closed: boolean,
  selected: ReadonlySet<number>,
  p: Point,
  zoom: number,
  strokePx: number,
  radiusPx: number = PATH_NODE_HIT_PX,
): PathEditHit {
  const radius = radiusPx / (zoom || 1);
  let best: PathEditHit = { kind: 'empty' };
  let bestD = radius;
  for (const h of visibleHandles(anchors, closed, selected)) {
    const d = dist(p, handleOf(anchors[h.node]!, h.side)!);
    if (d <= bestD) {
      bestD = d;
      best = { kind: 'handle', ...h };
    }
  }
  // The nearest of the handles and nodes; a node wins a tie, so a handle lying on its node never
  // hides the node.
  let node = -1;
  anchors.forEach((a, i) => {
    const d = dist(p, a);
    if (d <= bestD) {
      bestD = d;
      node = i;
    }
  });
  if (node >= 0) return { kind: 'node', node };
  if (best.kind === 'handle') return best;
  const near = nearestOnPath(anchors, closed, p);
  const reach = STROKE_HIT_SCREEN_PX / (zoom || 1) + strokePx / 2;
  if (near && near.distance <= reach) return { kind: 'segment', segment: near.segment, t: near.t };
  return { kind: 'empty' };
}

const shift = (p: Point, dx: number, dy: number) => ({ x: p.x + dx, y: p.y + dy });

/** The selected nodes moved by (dx, dy), their handles with them. */
export function moveNodes(
  anchors: readonly PathAnchor[],
  selected: ReadonlySet<number>,
  dx: number,
  dy: number,
): PathAnchor[] {
  return anchors.map((a, i) => {
    if (!selected.has(i)) return a;
    const out: PathAnchor = { ...a, ...shift(a, dx, dy) };
    if (a.handleIn) out.handleIn = shift(a.handleIn, dx, dy);
    if (a.handleOut) out.handleOut = shift(a.handleOut, dx, dy);
    return out;
  });
}

/**
 * One handle dragged to `to` (Shift: at 45° steps about its node): the partner follows the node's
 * mode (mirrored: angle and length, aligned: angle); Alt breaks the pair and the node turns corner.
 */
export function moveHandle(
  anchors: readonly PathAnchor[],
  i: number,
  side: HandleSide,
  to: Point,
  opts: { alt?: boolean; shift?: boolean },
): PathAnchor[] {
  const a = anchors[i]!;
  const target = opts.shift ? constrain45(a, to) : to;
  const partnerSide: HandleSide = side === 'in' ? 'out' : 'in';
  const mode = opts.alt ? 'corner' : a.mode;
  const partner = partnerHandle(a, target, handleOf(a, partnerSide), mode);
  const next: PathAnchor = { x: a.x, y: a.y, mode };
  const handleIn = side === 'in' ? target : partner;
  const handleOut = side === 'out' ? target : partner;
  if (handleIn) next.handleIn = { ...handleIn };
  if (handleOut) next.handleOut = { ...handleOut };
  return anchors.map((x, k) => (k === i ? next : x));
}

/** A corner turns smooth (mirrored handles along its neighbours); anything else turns corner. */
export function toggleSmooth(
  anchors: readonly PathAnchor[],
  i: number,
  closed: boolean,
): PathAnchor[] {
  const a = anchors[i]!;
  const next: PathAnchor =
    a.mode === 'corner'
      ? { x: a.x, y: a.y, mode: 'mirrored', ...smoothHandles(anchors, i, closed) }
      : { x: a.x, y: a.y, mode: 'corner' };
  return anchors.map((x, k) => (k === i ? next : x));
}

// A mirrored node whose handle a split or bend reshaped keeps its angle, not its equal lengths.
const loosen = (mode: PathAnchor['mode']) => (mode === 'mirrored' ? 'aligned' : mode);

/** A node added on segment `s` at `t`, the curve kept exactly (de Casteljau). */
export function insertNodeAt(
  anchors: readonly PathAnchor[],
  closed: boolean,
  s: number,
  t: number,
): { anchors: PathAnchor[]; index: number } {
  const seg = pathSegments(anchors, closed)[s]!;
  const [first, second] = splitSegment(seg, t);
  const out = anchors.map((a) => ({ ...a }));
  const node: PathAnchor = { x: first.p3.x, y: first.p3.y, mode: 'corner' };
  if (!seg.straight) {
    node.mode = 'aligned';
    node.handleIn = first.c2;
    node.handleOut = second.c1;
    // An end that had no handle keeps none: its split control lies on it.
    const from = out[seg.from]!;
    const to = out[seg.to]!;
    if (from.handleOut) out[seg.from] = { ...from, mode: loosen(from.mode), handleOut: first.c1 };
    if (to.handleIn) out[seg.to] = { ...to, mode: loosen(to.mode), handleIn: second.c2 };
  }
  const index = seg.to === 0 ? out.length : seg.to;
  out.splice(index, 0, node);
  return { anchors: out, index };
}

/** Segment `s` bent so it passes through `target` at `t`; its ends' partners follow their modes. */
export function bendAt(
  anchors: readonly PathAnchor[],
  closed: boolean,
  s: number,
  t: number,
  target: Point,
): PathAnchor[] {
  const seg = pathSegments(anchors, closed)[s]!;
  const { c1, c2 } = bendSegment(seg, t, target);
  const out = anchors.map((a) => ({ ...a }));
  const from = out[seg.from]!;
  const to = out[seg.to]!;
  const fromIn = partnerHandle(from, c1, from.handleIn, from.mode);
  out[seg.from] = { ...from, handleOut: c1, ...(fromIn ? { handleIn: fromIn } : {}) };
  const toOut = partnerHandle(to, c2, to.handleOut, to.mode);
  out[seg.to] = { ...out[seg.to]!, handleIn: c2, ...(toOut ? { handleOut: toOut } : {}) };
  return out;
}

/** The selected nodes removed; their neighbours join, keeping their facing handles. */
export function deleteNodes(
  anchors: readonly PathAnchor[],
  selected: ReadonlySet<number>,
): PathAnchor[] {
  return anchors.filter((_, i) => !selected.has(i));
}

/** J closes an open path whose two end nodes are both selected. */
export function canJoin(
  anchors: readonly PathAnchor[],
  closed: boolean,
  selected: ReadonlySet<number>,
): boolean {
  return !closed && anchors.length >= 2 && selected.has(0) && selected.has(anchors.length - 1);
}

/** The nodes inside a box (the node box drawn on empty space). */
export function nodesInBox(
  points: readonly Point[],
  box: { x: number; y: number; width: number; height: number },
): number[] {
  const out: number[] = [];
  points.forEach((p, i) => {
    if (p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height) {
      out.push(i);
    }
  });
  return out;
}

/**
 * The drag of the pressed node, snapped per axis to the nearest unmoved node or its own start
 * within `radius`, with the guide each snapped axis shows.
 */
export function snapNodeDelta(
  anchors: readonly PathAnchor[],
  moving: ReadonlySet<number>,
  pressed: number,
  dx: number,
  dy: number,
  radius: number,
): { dx: number; dy: number; guides: { x?: number; y?: number } } {
  const origin = anchors[pressed]!;
  const at = { x: origin.x + dx, y: origin.y + dy };
  const candidates: Point[] = [origin, ...anchors.filter((_, i) => !moving.has(i))];
  const nearest = (axis: 'x' | 'y') => {
    let best: number | undefined;
    let bestD = radius;
    for (const c of candidates) {
      const d = Math.abs(c[axis] - at[axis]);
      if (d <= bestD) {
        bestD = d;
        best = c[axis];
      }
    }
    return best;
  };
  const gx = nearest('x');
  const gy = nearest('y');
  const guides: { x?: number; y?: number } = {};
  if (gx !== undefined) guides.x = gx;
  if (gy !== undefined) guides.y = gy;
  return {
    dx: gx !== undefined ? gx - origin.x : dx,
    dy: gy !== undefined ? gy - origin.y : dy,
    guides,
  };
}

/** A canvas point in the path's own unrotated frame. */
export function toLocal(
  el: Pick<PathElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  p: Point,
): Point {
  const rotation = el.rotation ?? 0;
  if (rotation % 360 === 0) return p;
  const r = (-rotation * Math.PI) / 180;
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return {
    x: cx + (p.x - cx) * Math.cos(r) - (p.y - cy) * Math.sin(r),
    y: cy + (p.x - cx) * Math.sin(r) + (p.y - cy) * Math.cos(r),
  };
}

const unit = (x: number, y: number): Point | null => {
  const len = Math.hypot(x, y);
  return len === 0 ? null : { x: x / len, y: y / len };
};

// The line a node's two handles average to: the curve's direction through the node.
function averagedDirection(a: PathAnchor): Point | null {
  const out = unit(a.handleOut!.x - a.x, a.handleOut!.y - a.y);
  const into = unit(a.x - a.handleIn!.x, a.y - a.handleIn!.y);
  if (!out || !into) return out ?? into;
  return unit(out.x + into.x, out.y + into.y) ?? out;
}

/**
 * The edit toolbar's node type, set on every selected node: corner drops the handles; mirrored
 * averages them in angle and length (a lone handle is mirrored); aligned lines them up, each keeping
 * its length; a node with no handles takes `smoothHandles` for either smooth type.
 */
export function setNodeType(
  anchors: readonly PathAnchor[],
  selected: ReadonlySet<number>,
  type: PathAnchor['mode'],
  closed: boolean,
): PathAnchor[] {
  return anchors.map((a, i) => {
    if (!selected.has(i)) return a;
    const node = { x: a.x, y: a.y };
    if (type === 'corner') return { ...node, mode: 'corner' };
    if (!a.handleIn && !a.handleOut)
      return { ...node, mode: type, ...smoothHandles(anchors, i, closed) };
    if (!a.handleIn || !a.handleOut) {
      if (type === 'aligned') return { ...a, mode: 'aligned' };
      const lone = (a.handleOut ?? a.handleIn)!;
      const mirror = { x: 2 * a.x - lone.x, y: 2 * a.y - lone.y };
      return a.handleOut
        ? { ...node, mode: 'mirrored', handleIn: mirror, handleOut: { ...lone } }
        : { ...node, mode: 'mirrored', handleIn: { ...lone }, handleOut: mirror };
    }
    const dir = averagedDirection(a);
    if (!dir) return { ...a, mode: type };
    const outLen = Math.hypot(a.handleOut.x - a.x, a.handleOut.y - a.y);
    const inLen = Math.hypot(a.handleIn.x - a.x, a.handleIn.y - a.y);
    const [o, n] =
      type === 'mirrored' ? [(outLen + inLen) / 2, (outLen + inLen) / 2] : [outLen, inLen];
    return {
      ...node,
      mode: type,
      handleIn: { x: a.x - dir.x * n, y: a.y - dir.y * n },
      handleOut: { x: a.x + dir.x * o, y: a.y + dir.y * o },
    };
  });
}

/** The node type every selected node shares, or null (none selected, or a mix). */
export function sharedNodeType(
  anchors: readonly PathAnchor[],
  selected: ReadonlySet<number>,
): PathAnchor['mode'] | null {
  const modes = new Set([...selected].map((i) => anchors[i]?.mode).filter((m) => m !== undefined));
  return modes.size === 1 ? [...modes][0]! : null;
}

/** A closed path cut at node `i`: it runs from `i` round to a copy of `i`, both corner ends. */
export function openPathAt(anchors: readonly PathAnchor[], i: number): PathAnchor[] {
  const a = anchors[i]!;
  const start: PathAnchor = { x: a.x, y: a.y, mode: 'corner' };
  if (a.handleOut) start.handleOut = { ...a.handleOut };
  const end: PathAnchor = { x: a.x, y: a.y, mode: 'corner' };
  if (a.handleIn) end.handleIn = { ...a.handleIn };
  return [start, ...anchors.slice(i + 1), ...anchors.slice(0, i), end];
}

/** A point of the path's own unrotated frame, where it shows on the canvas. */
export function toWorld(
  el: Pick<PathElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  p: Point,
): Point {
  return toLocal({ ...el, rotation: -(el.rotation ?? 0) }, p);
}

/**
 * The selected nodes dragged by `delta` from where the drag began: Shift holds it to 45° steps;
 * otherwise the pressed node snaps into line (snapNodeDelta) and the snapped axes show a guide.
 */
export function dragNodes(
  base: readonly PathAnchor[],
  moving: ReadonlySet<number>,
  pressed: number,
  delta: Point,
  shift: boolean,
  snapRadius: number,
): { anchors: PathAnchor[]; guides: { x?: number; y?: number } | null } {
  if (shift) {
    const d = constrain45({ x: 0, y: 0 }, delta);
    return { anchors: moveNodes(base, moving, d.x, d.y), guides: null };
  }
  const snap = snapNodeDelta(base, moving, pressed, delta.x, delta.y, snapRadius);
  const snapped = snap.guides.x !== undefined || snap.guides.y !== undefined;
  return {
    anchors: moveNodes(base, moving, snap.dx, snap.dy),
    guides: snapped ? snap.guides : null,
  };
}

// A pen nib with a plus: a press here adds a node, a drag bends the segment. Black on a white rim,
// so it reads on either board; the hotspot is the nib's tip.
const PEN_PLUS_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>" +
  "<g fill='none' stroke-linecap='round' stroke-linejoin='round'>" +
  "<path d='M3 3 L6.5 12 L11 16 L16 11 L12 6.5 Z M3 3 L9 9' stroke='white' stroke-width='4'/>" +
  "<path d='M3 3 L6.5 12 L11 16 L16 11 L12 6.5 Z M3 3 L9 9' stroke='black' stroke-width='1.5'/>" +
  "<path d='M18 15 V23 M14 19 H22' stroke='white' stroke-width='4'/>" +
  "<path d='M18 15 V23 M14 19 H22' stroke='black' stroke-width='1.6'/>" +
  '</g></svg>';
export const PATH_ADD_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(PEN_PLUS_SVG)}") 3 3, copy`;

/**
 * The cursor edit mode shows over what a press would land on (docs/specs/023-whiteboard/path-tool.md
 * "Cursors in edit mode"): move over a node or handle, the pen with a plus over a segment, the
 * arrow elsewhere, the fill included. Never a text cursor.
 */
export function pathEditCursor(hit: PathEditHit): string {
  if (hit.kind === 'node' || hit.kind === 'handle') return 'move';
  if (hit.kind === 'segment') return PATH_ADD_CURSOR;
  return 'default';
}
