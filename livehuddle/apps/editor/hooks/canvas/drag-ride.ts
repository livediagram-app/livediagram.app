// Which elements a drag preview only translates (docs/specs/008-canvas/drag-preview.md "Moves ride an offset"): drawn
// as the document has them, shifted by an offset the page applies outside React, so a move frame renders none of
// them. A box rides when its position is all that changed. A retired arrow never rides: it does not move, and the
// ends that follow a moved element are drawn from the preview (useLayerDragPreview). Linear in what the preview
// changed.

import { isBoxed, type Element } from '@livehuddle/document';
import type { DragOverlay } from '@/lib/drag-preview';
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
// `before` is the board the preview is laid over, by id.
export function ridingElements(
  overlay: DragOverlay,
  before: ReadonlyMap<string, Element>,
): Map<string, RideOffset> {
  const rides = new Map<string, RideOffset>();
  for (const [id, el] of overlay.changed) {
    const was = before.get(id);
    if (!was || !isBoxed(el) || !isBoxed(was)) continue;
    if (sameBut(el, was, BOX_POSITION)) rides.set(id, rideOffset(el.x - was.x, el.y - was.y));
  }
  return rides;
}
