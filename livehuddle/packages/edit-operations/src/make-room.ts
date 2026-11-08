// Make room (docs/specs/024-agents/blueprints/edit-operations.md "Make room", EO47): what an insert
// shifts so its new node fits. The boxes of b's connected group along pinned arrows whose centre lies
// past the midline on the flow axis shift by the room needed.

import type { Element, ElementId } from '@livehuddle/document';
import { boxOf, shifted, type Box } from './placement';
import { currentElements, moveElement, type EditState } from './state';

export type Axis = { horizontal: boolean; sign: 1 | -1 };

// The ids joined to `start` along pinned arrows, either way.
function component(elements: readonly Element[], start: ElementId): Set<ElementId> {
  const links = new Map<ElementId, ElementId[]>();
  for (const el of elements) {
    if (el.type !== 'arrow' || el.from.kind !== 'pinned' || el.to.kind !== 'pinned') continue;
    const [a, b] = [el.from.elementId, el.to.elementId];
    links.set(a, [...(links.get(a) ?? []), b]);
    links.set(b, [...(links.get(b) ?? []), a]);
  }
  const seen = new Set([start]);
  const queue = [start];
  for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
    // Every id reached is the end of an arrow, b included: the a→b arrow insert splits.
    for (const next of links.get(at)!) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

// The far edge of a box on the axis, and a box's centre on it.
const farEdgeOf = (box: Box, { horizontal, sign }: Axis) =>
  horizontal ? (sign > 0 ? box.x + box.width : box.x) : sign > 0 ? box.y + box.height : box.y;
const alongOf = (box: Box, { horizontal }: Axis) =>
  horizontal ? box.x + box.width / 2 : box.y + box.height / 2;

// Room for `node` between a and b, by `shift` along the axis: the midline is the node's near edge,
// less half the gap (EO32).
export function makeRoom(
  state: EditState,
  {
    node,
    b,
    axis,
    shift,
    gap,
  }: { node: Element & Box; b: ElementId; axis: Axis; shift: number; gap: number },
  operation: number,
): void {
  const before = currentElements(state).filter((el) => el.id !== node.id);
  const near = farEdgeOf(node, { horizontal: axis.horizontal, sign: axis.sign > 0 ? -1 : 1 });
  const midline = near - (axis.sign * gap) / 2;
  const [dx, dy] = axis.horizontal ? [shift * axis.sign, 0] : [0, shift * axis.sign];
  let count = 0;
  for (const id of component(before, b)) {
    const el = state.byId.get(id)!;
    const along = alongOf(boxOf(el)!, axis);
    if (axis.sign > 0 ? along <= midline : along >= midline) continue;
    moveElement(state, shifted(el, dx, dy), operation, 'make room', { shift: [dx, dy] });
    count += 1;
  }
  state.log('[edit-ops] make-room', {
    operation,
    shifted: count,
    axis: axis.horizontal ? 'x' : 'y',
  });
}
