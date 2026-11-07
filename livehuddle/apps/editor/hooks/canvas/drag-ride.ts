// Which elements a drag preview only translates (docs/specs/008-canvas/drag-preview.md "Moves ride an offset"): drawn
// as the document has them, shifted by an offset the page applies outside React, so a move frame renders none of
// them. A box rides when its position is all that changed; an arrow when both its ends move by the same offset
// (pinned to boxes riding it, or free ends shifted by it). Everything else draws from the preview, as before.
// Linear in what the preview changed.

import { isBoxed, type ArrowElement, type Element } from '@livehuddle/document';
import type { DragOverlay } from '@/lib/drag-preview';
import type { ArrowLinks } from '@/components/canvas/drag-affected-arrows';
import { rideOffset, type RideOffset } from '@liveworkspace/workbench/lib/drag-ride-dom';

export type { RideOffset } from '@liveworkspace/workbench/lib/drag-ride-dom';

// Every field but `except` holds the same value.
function sameBut(a: Element, b: Element, except: readonly string[]): boolean {
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
  now: ArrowElement['from'],
  was: ArrowElement['from'],
  rides: ReadonlyMap<string, RideOffset>,
): RideOffset | null {
  if (now.kind === 'free' && was.kind === 'free') return rideOffset(now.x - was.x, now.y - was.y);
  if (now.kind === 'pinned' && was.kind === 'pinned') {
    // The same pin: the same object, as a move leaves it, or the same value.
    if (now !== was && JSON.stringify(now) !== JSON.stringify(was)) return null;
    return rides.get(now.elementId) ?? null;
  }
  return null;
}

function arrowOffset(
  now: ArrowElement,
  was: ArrowElement,
  rides: ReadonlyMap<string, RideOffset>,
): RideOffset | null {
  if (now !== was && !sameBut(now, was, ARROW_ENDS)) return null;
  const from = endOffset(now.from, was.from, rides);
  const to = endOffset(now.to, was.to, rides);
  return from && to && from.dx === to.dx && from.dy === to.dy ? from : null;
}

// `before` is the board the preview is laid over, by id; `still` the ids that never ride (a stack's children).
export function ridingElements(
  overlay: DragOverlay,
  before: ReadonlyMap<string, Element>,
  links: ArrowLinks | null,
  still: ReadonlySet<string>,
): Map<string, RideOffset> {
  const rides = new Map<string, RideOffset>();
  for (const [id, el] of overlay.changed) {
    const was = before.get(id);
    if (!was || still.has(id) || !isBoxed(el) || !isBoxed(was)) continue;
    if (sameBut(el, was, BOX_POSITION)) rides.set(id, rideOffset(el.x - was.x, el.y - was.y));
  }
  if (rides.size === 0) return rides;
  // The arrows the gesture changed, and those pinned to a box that rides.
  const arrows = new Set<string>();
  for (const [id, el] of overlay.changed) if (el.type === 'arrow') arrows.add(id);
  for (const id of [...rides.keys()])
    for (const dep of links?.dependants.get(id) ?? []) arrows.add(dep);
  for (const id of arrows) {
    const was = before.get(id);
    const now = overlay.changed.get(id) ?? was;
    if (!was || !now || was.type !== 'arrow' || now.type !== 'arrow' || still.has(id)) continue;
    const offset = arrowOffset(now, was, rides);
    if (offset) rides.set(id, offset);
  }
  return rides;
}
