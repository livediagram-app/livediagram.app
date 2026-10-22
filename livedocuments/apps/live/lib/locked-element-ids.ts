// What a tidy must not move (docs/specs/008-canvas/layout-cleanup.md "Locked elements stay put"): its own
// module so a caller that only needs the lock rule (Pages mode's page edits) does not load the tidiers.

import {
  lockedLayerElementIds,
  type Element,
  type ElementId,
  type Layer,
} from '@livedocuments/document';

/** Ids a cleanup must not move: each element's own lock plus its layer's. O(n). */
export function lockedElementIds(elements: Element[], layers?: Layer[]): Set<ElementId> {
  const ids = lockedLayerElementIds(elements, layers);
  for (const el of elements) if (el.locked === true) ids.add(el.id);
  return ids;
}
