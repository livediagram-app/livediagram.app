// Which elements a drag preview only translates (each editor's docs/specs/008-canvas/drag-preview.md "Moves ride an
// offset"): drawn as the board has them, shifted by an offset the page applies outside React (drag-ride-dom.ts), so a
// move frame renders none of them. A box rides when its position is all that changed; an arrow when both its ends
// move by the same offset (pinned to boxes riding it, or free ends shifted by it). Everything else draws from the
// preview, as before. Linear in what the preview changed.

import type { ArrowLinks, DragArrowEnd, DragOverlayLike } from './drag-affected-arrows';
import { rideOffset, type RideOffset } from './drag-ride-dom';

export type { RideOffset } from './drag-ride-dom';

type Identified = { readonly id: string; readonly type: string };
type FreeEnd = { readonly kind: 'free'; readonly x: number; readonly y: number };
type PinnedEnd = { readonly kind: 'pinned'; readonly elementId: string };
type ArrowLike = { readonly from: DragArrowEnd; readonly to: DragArrowEnd };

export type RideRules<E> = {
  // Whether an element is a box (it has `x` and `y`).
  isBoxed: (el: E) => boolean;
  // The arrows' links (from buildArrowLinks), or null on a board without them: only the arrows the gesture changed
  // are then considered.
  links?: ArrowLinks | null;
  // The ids that never ride (a stack's children, which glide).
  still?: ReadonlySet<string>;
  // Whether arrows ride at all (false where they never move with their ends: livehuddle's retired arrows).
  arrowsRide?: boolean;
};

// Every field but `except` holds the same value.
function sameBut(a: object, b: object, except: readonly string[]): boolean {
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ka = Object.keys(ra);
  if (ka.length !== Object.keys(rb).length) return false;
  for (const k of ka) if (!except.includes(k) && ra[k] !== rb[k]) return false;
  return true;
}

const BOX_POSITION = ['x', 'y'] as const;
const ARROW_ENDS = ['from', 'to'] as const;

// The offset an arrow end moved by, or null when it did anything but ride.
function endOffset(
  now: DragArrowEnd,
  was: DragArrowEnd,
  rides: ReadonlyMap<string, RideOffset>,
): RideOffset | null {
  if (now.kind === 'free' && was.kind === 'free') {
    const [n, w] = [now as FreeEnd, was as FreeEnd];
    return rideOffset(n.x - w.x, n.y - w.y);
  }
  if (now.kind === 'pinned' && was.kind === 'pinned') {
    // The same pin: the same object, as a move leaves it, or the same value.
    if (now !== was && JSON.stringify(now) !== JSON.stringify(was)) return null;
    return rides.get((now as PinnedEnd).elementId) ?? null;
  }
  return null;
}

function arrowOffset(
  now: ArrowLike,
  was: ArrowLike,
  rides: ReadonlyMap<string, RideOffset>,
): RideOffset | null {
  if (now !== was && !sameBut(now, was, ARROW_ENDS)) return null;
  const from = endOffset(now.from, was.from, rides);
  const to = endOffset(now.to, was.to, rides);
  return from && to && from.dx === to.dx && from.dy === to.dy ? from : null;
}

const NOTHING: ReadonlySet<string> = new Set();
// A boxed element's position: every product's boxes carry `x` and `y` (isBoxed has said it is one).
const positionOf = (el: unknown) => el as { readonly x: number; readonly y: number };

// `before` is the board the preview is laid over, by id.
export function ridingElements<E extends Identified>(
  overlay: Pick<DragOverlayLike<E>, 'changed'>,
  before: ReadonlyMap<string, E>,
  rules: RideRules<E>,
): Map<string, RideOffset> {
  const { isBoxed, links = null, still = NOTHING, arrowsRide = true } = rules;
  const rides = new Map<string, RideOffset>();
  for (const [id, el] of overlay.changed) {
    const was = before.get(id);
    if (!was || still.has(id) || !isBoxed(el) || !isBoxed(was)) continue;
    if (sameBut(el, was, BOX_POSITION)) {
      const now = positionOf(el);
      const then = positionOf(was);
      rides.set(id, rideOffset(now.x - then.x, now.y - then.y));
    }
  }
  if (rides.size === 0 || !arrowsRide) return rides;
  // The arrows the gesture changed, and those pinned to a box that rides.
  const arrows = new Set<string>();
  for (const [id, el] of overlay.changed) if (el.type === 'arrow') arrows.add(id);
  for (const id of [...rides.keys()])
    for (const dep of links?.dependants.get(id) ?? []) arrows.add(dep);
  for (const id of arrows) {
    const was = before.get(id);
    const now = overlay.changed.get(id) ?? was;
    if (!was || !now || was.type !== 'arrow' || now.type !== 'arrow' || still.has(id)) continue;
    const offset = arrowOffset(now as unknown as ArrowLike, was as unknown as ArrowLike, rides);
    if (offset) rides.set(id, offset);
  }
  return rides;
}
