// Reachability along pinned arrows (docs/specs/024-agents/blueprints/edit-operations.md
// "Selectors", EO13): `downstream:x` follows arrows from their `from` to their `to`, `upstream:x`
// against them. One breadth-first walk over an adjacency map; the start itself is left out.

import type { Element, ElementId } from '@livediagram/document';

export type Direction = 'downstream' | 'upstream';

export function reachableFrom(
  elements: readonly Element[],
  start: ElementId,
  direction: Direction,
): Set<ElementId> {
  const next = new Map<ElementId, ElementId[]>();
  for (const el of elements) {
    if (el.type !== 'arrow' || el.from.kind !== 'pinned' || el.to.kind !== 'pinned') continue;
    const [a, b] =
      direction === 'downstream'
        ? [el.from.elementId, el.to.elementId]
        : [el.to.elementId, el.from.elementId];
    next.set(a, [...(next.get(a) ?? []), b]);
  }
  const seen = new Set<ElementId>([start]);
  const queue = [start];
  for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
    for (const id of next.get(at) ?? []) {
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(id);
    }
  }
  seen.delete(start);
  return seen;
}
