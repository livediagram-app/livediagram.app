// What a tidy must not move (docs/specs/008-canvas/layout-cleanup.md "Locked elements stay put"): its own
// module so a caller that only needs the lock rule does not load the tidiers.

import type { Element, ElementId } from '@livehuddle/document';

/** Ids a cleanup must not move: the locked elements. O(n). */
export function lockedElementIds(elements: Element[]): Set<ElementId> {
  const ids = new Set<ElementId>();
  for (const el of elements) if (el.locked === true) ids.add(el.id);
  return ids;
}
