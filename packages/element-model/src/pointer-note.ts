// The pointer note (docs/specs/009-elements/pointer-note.md, blueprint pointer-note.md): a note with a leader line to a
// tip that may attach to a point on a host, the badge's way. The tip is stored relative to the note's top-left, so the
// note carries it; settling (attachment.ts) keeps an attached tip on its point.
//
// A LEAF module: types only from './element', the attachment helpers it shares with the badge.

import {
  ATTACH_POINTS,
  attachPointXY,
  canHost,
  sideMiddleFacing,
  type AttachPoint,
} from './attachment';
import { anchorPosition } from './geometry';
import { offeredAnchors } from './anchors';
import type { Point, Rect } from '@liveworkspace/model-core/geometry-primitives';
import type { Anchor, BoxedElement, Element, ShapeElement } from './element';

/** The furthest a tip may sit from its note, either axis. */
const POINTER_TIP_MAX = 4000;
/** The tip a note has before anyone moves it (D190): 56 px below its bottom-left corner, 24 px left of it. */
const POINTER_TIP_DEFAULT = { dx: -24, dyBelow: 56 } as const;

export function isPointerNote(el: Element): el is ShapeElement & { shape: 'pointer-note' } {
  return el.type === 'shape' && el.shape === 'pointer-note';
}

export function isPointerTip(v: unknown): v is Point {
  if (typeof v !== 'object' || v === null) return false;
  const { x, y } = v as Point;
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Math.abs(x) <= POINTER_TIP_MAX &&
    Math.abs(y) <= POINTER_TIP_MAX
  );
}

/** The note's tip, relative to its top-left: its own when valid, else the default. */
export function pointerTipOf(el: ShapeElement): Point {
  return isPointerTip(el.pointerTip)
    ? el.pointerTip
    : { x: POINTER_TIP_DEFAULT.dx, y: el.height + POINTER_TIP_DEFAULT.dyBelow };
}

/** The note with its tip at `tip` (relative), rounded to a tenth. */
export function withPointerTip<T extends Element>(el: T, tip: Point): T {
  if (!isPointerNote(el)) return el;
  return {
    ...el,
    pointerTip: { x: Math.round(tip.x * 10) / 10, y: Math.round(tip.y * 10) / 10 },
  };
}

/** The leader in note-local coordinates: from the note's box point nearest the tip, to the tip. Null when the tip is
 *  inside the box (nothing to join). */
export function pointerLeader(
  el: ShapeElement,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const t = pointerTipOf(el);
  const inside = t.x >= 0 && t.x <= el.width && t.y >= 0 && t.y <= el.height;
  if (inside) return null;
  const x1 = Math.min(Math.max(t.x, 0), el.width);
  const y1 = Math.min(Math.max(t.y, 0), el.height);
  return { x1, y1, x2: t.x, y2: t.y };
}

type Boxed = Element & Rect & { rotation?: number };

/** How close (element px) the tip comes to an anchor to take it: an arrow end's reach (SNAP_THRESHOLD). */
const TIP_SNAP_PX = 24;

/** Whether `p` is inside the host's box, turned with it. */
function insideBox(host: Boxed, p: Point): boolean {
  const cx = host.x + host.width / 2;
  const cy = host.y + host.height / 2;
  const r = (-(host.rotation ?? 0) * Math.PI) / 180;
  const dx = p.x - cx;
  const dy = p.y - cy;
  const lx = dx * Math.cos(r) - dy * Math.sin(r);
  const ly = dx * Math.sin(r) + dy * Math.cos(r);
  return Math.abs(lx) <= host.width / 2 && Math.abs(ly) <= host.height / 2;
}

/** Where the tip at `tipAbs` would attach, as an arrow end would (pointer-note.md "Attaching the tip"): the anchor
 *  within reach of any host, else over a host's body its nearest anchor (the topmost host's); with every anchor that
 *  host offers, for the drag's snap dots. Null when the tip is near no host. Hosts whose bounding circle the point is
 *  not near are skipped before their anchors are worked out. */
export function pointerTipTarget(
  elements: readonly Element[],
  note: ShapeElement,
  tipAbs: Point,
): {
  host: Boxed;
  anchors: { anchor: Anchor; at: Point }[];
  hit: { anchor: Anchor; at: Point };
} | null {
  let near: { host: Boxed; anchor: Anchor; at: Point; d: number } | null = null;
  let body: Boxed | null = null;
  // Top down, so the topmost host wins a tie and the body test.
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]!;
    if (el.id === note.id || !canHost(el) || isPointerNote(el)) continue;
    const host = el as Boxed;
    const dx = tipAbs.x - (host.x + host.width / 2);
    const dy = tipAbs.y - (host.y + host.height / 2);
    const reach = Math.hypot(host.width, host.height) / 2 + TIP_SNAP_PX;
    if (dx * dx + dy * dy > reach * reach) continue;
    for (const anchor of offeredAnchors(host as unknown as BoxedElement)) {
      const at = anchorPosition(host as unknown as BoxedElement, anchor);
      const d = Math.hypot(tipAbs.x - at.x, tipAbs.y - at.y);
      if (d <= TIP_SNAP_PX && (!near || d < near.d)) near = { host, anchor, at, d };
    }
    if (!body && insideBox(host, tipAbs)) body = host;
  }
  const hostOf = near?.host ?? body;
  if (!hostOf) return null;
  const host = hostOf as unknown as BoxedElement;
  const anchors = offeredAnchors(host).map((anchor) => ({
    anchor,
    at: anchorPosition(host, anchor),
  }));
  // Over the body, away from any anchor: the middle of the side facing the note, as an arrow dropped on a shape takes
  // the side facing its other end.
  const facing = near && near.host === hostOf ? null : sideMiddleFacing(host, note);
  const hit =
    near && near.host === hostOf
      ? { anchor: near.anchor, at: near.at }
      : (anchors.find((a) => a.anchor === facing) ?? anchors[0]!);
  return { host: hostOf, anchors, hit };
}

/** The badge point nearest `at` on `host`: kept beside the anchor for readers that know only the badge's points. */
function nearestAttachPoint(host: Boxed, at: Point): AttachPoint {
  let best: AttachPoint = 'top';
  let bestD = Infinity;
  for (const point of ATTACH_POINTS) {
    const p = attachPointXY(host, point);
    const d = Math.hypot(at.x - p.x, at.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = point;
    }
  }
  return best;
}

/** Where a tip dragged to `tipAbs` (canvas coordinates) lands: on the arrow anchor in reach (pointer-note.md
 *  "Attaching the tip"), attaching the note there, or free (detached) where it was let go. */
export function snapPointerTip(
  elements: readonly Element[],
  note: ShapeElement,
  tipAbs: Point,
): { pointerTip: Point; attachedTo?: string; attachAt?: AttachPoint; pointerAnchor?: Anchor } {
  const target = pointerTipTarget(elements, note, tipAbs);
  if (target)
    return {
      pointerTip: { x: target.hit.at.x - note.x, y: target.hit.at.y - note.y },
      attachedTo: target.host.id,
      attachAt: nearestAttachPoint(target.host, target.hit.at),
      pointerAnchor: target.hit.anchor,
    };
  return { pointerTip: { x: tipAbs.x - note.x, y: tipAbs.y - note.y } };
}
