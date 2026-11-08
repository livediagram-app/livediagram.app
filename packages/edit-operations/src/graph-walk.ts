// Reachability along pinned arrows (docs/specs/024-agents/blueprints/edit-operations.md
// "Selectors", EO13): `downstream:x` follows arrows from their `from` to their `to`, `upstream:x`
// against them. One breadth-first walk over an adjacency map; the start itself is left out.

import type { EndRefPoint } from './element-text';

export type Direction = 'downstream' | 'upstream';

// An element as far as the walk reads it: an arrow's ends, and nothing of anything else.
export type WalkedElement = { type: string; from?: EndRefPoint; to?: EndRefPoint };

export function reachableFrom(
  elements: readonly WalkedElement[],
  start: string,
  direction: Direction,
): Set<string> {
  const next = new Map<string, string[]>();
  for (const el of elements) {
    if (el.type !== 'arrow' || el.from?.kind !== 'pinned' || el.to?.kind !== 'pinned') continue;
    const [a, b] =
      direction === 'downstream'
        ? [el.from.elementId, el.to.elementId]
        : [el.to.elementId, el.from.elementId];
    // Pushed in place: a copy per arrow made a hub's out-arrows quadratic.
    const out = next.get(a);
    if (out) out.push(b);
    else next.set(a, [b]);
  }
  const seen = new Set<string>([start]);
  const queue = [start];
  // An index into the queue rather than shift(), which moves every later entry.
  for (let head = 0; head < queue.length; head++) {
    for (const id of next.get(queue[head]!) ?? []) {
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(id);
    }
  }
  seen.delete(start);
  return seen;
}
