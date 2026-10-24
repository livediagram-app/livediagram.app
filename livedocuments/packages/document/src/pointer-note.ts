// The pointer note (docs/specs/009-elements/pointer-note.md, blueprint pointer-note.md): a note with a leader line to a
// tip that may attach to a point on a host, the badge's way. The tip is stored relative to the note's top-left, so the
// note carries it; settling (attachment.ts) keeps an attached tip on its point.
//
// A LEAF module: types only from './index', the attachment helpers it shares with the badge.

import { ATTACH_SNAP_PX, attachPointXY, canHost, type AttachPoint } from './attachment';
import type { Point, Rect } from '@liveworkspace/document-core/geometry-primitives';
import type { Element, ShapeElement } from './index';

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

/** Where a tip dragged to `tipAbs` (canvas coordinates) lands: on the nearest host point within reach, attaching the
 *  note there, or free (detached) where it was let go. */
export function snapPointerTip(
  elements: readonly Element[],
  note: ShapeElement,
  tipAbs: Point,
): { pointerTip: Point; attachedTo?: string; attachAt?: AttachPoint } {
  let best: { id: string; point: AttachPoint; at: Point; d: number } | null = null;
  for (const el of elements) {
    if (el.id === note.id || !canHost(el) || isPointerNote(el)) continue;
    const host = el as Boxed;
    const dx = tipAbs.x - (host.x + host.width / 2);
    const dy = tipAbs.y - (host.y + host.height / 2);
    const reach = Math.hypot(host.width, host.height) / 2 + ATTACH_SNAP_PX;
    if (dx * dx + dy * dy > reach * reach) continue;
    for (const point of [
      'top-left',
      'top',
      'top-right',
      'right',
      'bottom-right',
      'bottom',
      'bottom-left',
      'left',
    ] as const) {
      const at = attachPointXY(host, point);
      const d = Math.hypot(tipAbs.x - at.x, tipAbs.y - at.y);
      if (d <= ATTACH_SNAP_PX && (!best || d <= best.d)) best = { id: host.id, point, at, d };
    }
  }
  if (best)
    return {
      pointerTip: { x: best.at.x - note.x, y: best.at.y - note.y },
      attachedTo: best.id,
      attachAt: best.point,
    };
  return { pointerTip: { x: tipAbs.x - note.x, y: tipAbs.y - note.y } };
}
