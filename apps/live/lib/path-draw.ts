// The Path tool's drawing state (docs/specs/023-draw-mode/path-tool.md "Drawing"): pure steps over
// the path being drawn. The gesture (components/canvas/path/usePathDrawGesture) turns pointer and
// key events into these steps; nothing here touches the DOM or the document.
import {
  constrain45,
  isCompoundPath,
  pathWorldAnchors,
  reversePath,
  type Element,
  type PathAnchor,
  type PathElement,
} from '@livediagram/document';

type Point = { x: number; y: number };

// Screen px: how near the first node closes, an end node continues, the last node cusps.
export const PATH_CLOSE_PX = 8;
// Screen px a press moves before it is a drag rather than a click.
export const PATH_DRAG_THRESHOLD_PX = 3;
// Two presses on the same node within this are a double-click.
export const PATH_DOUBLE_PRESS_MS = 500;

/** The path being drawn. `placed` counts the nodes this draft placed (Backspace removes only those). */
export type PathDraft = {
  anchors: PathAnchor[];
  placed: number;
  continuing: { id: string } | null;
  // When the last node was placed (ms), for telling a double-click from a later press.
  lastPlacedAt: number | null;
};

/** An end node of an open path, where a press resumes drawing. */
export type PathEnd = { id: string; end: 'start' | 'end'; point: Point };

export type PathPress =
  | { kind: 'finish' }
  | { kind: 'close' }
  | { kind: 'cusp' }
  | { kind: 'continue'; end: PathEnd }
  // A placed node other than the first and the last: a drag moves it, a click does nothing.
  | { kind: 'node'; index: number }
  | { kind: 'place' };

const near = (a: Point, b: Point, radius: number) => Math.hypot(a.x - b.x, a.y - b.y) <= radius;

/** What a press with the Path tool does, in the order the spec reads. */
export function classifyPathPress(
  draft: PathDraft | null,
  p: Point,
  // A finger reaches further (PATH_TOUCH_HIT_PX); a mouse or pen PATH_CLOSE_PX.
  opts: { zoom: number; now: number; ends: readonly PathEnd[]; radiusPx?: number },
): PathPress {
  const radius = (opts.radiusPx ?? PATH_CLOSE_PX) / (opts.zoom || 1);
  if (draft && draft.anchors.length > 0) {
    const last = draft.anchors[draft.anchors.length - 1]!;
    const onLast = near(p, last, radius);
    const recent =
      draft.lastPlacedAt !== null && opts.now - draft.lastPlacedAt <= PATH_DOUBLE_PRESS_MS;
    if (onLast && recent) return { kind: 'finish' };
    if (draft.anchors.length >= 2 && near(p, draft.anchors[0]!, radius)) return { kind: 'close' };
    if (onLast) return { kind: 'cusp' };
    const index = draft.anchors.findIndex(
      (a, i) => i > 0 && i < draft.anchors.length - 1 && near(p, a, radius),
    );
    if (index > 0) return { kind: 'node', index };
    return { kind: 'place' };
  }
  const end = opts.ends.find((e) => near(p, e.point, radius));
  return end ? { kind: 'continue', end } : { kind: 'place' };
}

/** A new corner node at `p` (Shift: on a 45° line from the last node). */
export function placeNode(
  draft: PathDraft | null,
  p: Point,
  now: number,
  shift: boolean,
): PathDraft {
  const last = draft?.anchors[draft.anchors.length - 1];
  const at = shift && last ? constrain45(last, p) : p;
  const node: PathAnchor = { x: at.x, y: at.y, mode: 'corner' };
  return {
    anchors: [...(draft?.anchors ?? []), node],
    placed: (draft?.placed ?? 0) + 1,
    continuing: draft?.continuing ?? null,
    lastPlacedAt: now,
  };
}

/**
 * The node's handles as a drag shapes them: `handleOut` follows the pointer (Shift: at 45° steps)
 * and `handleIn` mirrors it; with Alt the node becomes a corner and `handleIn` stays where it is.
 */
export function shapeHandles(
  anchor: PathAnchor,
  pointer: Point,
  opts: { alt: boolean; shift: boolean },
): PathAnchor {
  const out = opts.shift ? constrain45(anchor, pointer) : pointer;
  const handleOut = { x: out.x, y: out.y };
  if (opts.alt) return { ...anchor, mode: 'corner', handleOut };
  return {
    ...anchor,
    mode: 'mirrored',
    handleOut,
    handleIn: { x: 2 * anchor.x - out.x, y: 2 * anchor.y - out.y },
  };
}

/** The node moved by (dx, dy), its handles with it (Space held while placing). */
export function translateAnchor(anchor: PathAnchor, dx: number, dy: number): PathAnchor {
  const move = (p: Point) => ({ x: p.x + dx, y: p.y + dy });
  const out: PathAnchor = { ...anchor, ...move(anchor) };
  if (anchor.handleIn) out.handleIn = move(anchor.handleIn);
  if (anchor.handleOut) out.handleOut = move(anchor.handleOut);
  return out;
}

/** Replace one node of the draft. */
export function withAnchor(draft: PathDraft, index: number, anchor: PathAnchor): PathDraft {
  return { ...draft, anchors: draft.anchors.map((a, i) => (i === index ? anchor : a)) };
}

/** The last node loses its outgoing handle, so the next segment leaves it straight. */
export function cuspLast(draft: PathDraft): PathDraft {
  const i = draft.anchors.length - 1;
  const last = draft.anchors[i];
  if (!last?.handleOut) return draft;
  const { handleOut: _out, ...rest } = last;
  return withAnchor(draft, i, { ...rest, mode: 'corner' });
}

/** Backspace: the last node this draft placed goes; null when none is left (the draft cancels). */
export function removeLastPlaced(draft: PathDraft): PathDraft | null {
  if (draft.placed <= 1) return null;
  return {
    ...draft,
    anchors: draft.anchors.slice(0, -1),
    placed: draft.placed - 1,
    lastPlacedAt: null,
  };
}

/** The segment from the last node to the pointer, curved by that node's outgoing handle. */
export function rubberBand(
  draft: PathDraft | null,
  cursor: Point,
  shift: boolean,
): { p0: Point; c1: Point; c2: Point; p3: Point } | null {
  const last = draft?.anchors[draft.anchors.length - 1];
  if (!last) return null;
  const to = shift ? constrain45(last, cursor) : cursor;
  const p0 = { x: last.x, y: last.y };
  const p3 = { x: to.x, y: to.y };
  return { p0, c1: last.handleOut ?? p0, c2: p3, p3 };
}

/** Where a press can pick an open path up again: both ends of each open, unlocked, reachable path
 *  of one line (a path of several, a merged mirrored line, moves and restyles as a whole: its
 *  points are not edited one by one, docs/specs/007-editor/logo-pages.md "Mirror"). */
export function openPathEnds(
  elements: readonly Element[],
  inertIds: ReadonlySet<string>,
): PathEnd[] {
  const ends: PathEnd[] = [];
  for (const el of elements) {
    if (el.type !== 'path' || el.closed || el.locked || isCompoundPath(el) || inertIds.has(el.id))
      continue;
    const anchors = pathWorldAnchors(el);
    const first = anchors[0];
    const last = anchors[anchors.length - 1];
    if (!first || !last) continue;
    ends.push({ id: el.id, end: 'start', point: { x: first.x, y: first.y } });
    ends.push({ id: el.id, end: 'end', point: { x: last.x, y: last.y } });
  }
  return ends;
}

/** A draft resuming `el` from the end pressed, turned so new nodes always append. */
export function continueDraft(el: PathElement, end: 'start' | 'end'): PathDraft {
  const world = pathWorldAnchors(el);
  return {
    anchors: end === 'start' ? reversePath(world) : world,
    placed: 0,
    continuing: { id: el.id },
    lastPlacedAt: null,
  };
}
