// Make room (docs/specs/024-agents/blueprints/edit-operations.md "Make room", EO47): what an insert
// shifts so its new node fits. Within b's container, the container's direct members; without one, the
// top-level units of b's connected group along pinned arrows. Whatever lies past the midline on the
// flow axis shifts by the room needed, a container with what it carries. The container grows on its
// far side, and room is made beyond it in its own scope in turn, so a grown container never takes in
// what sat past it. Locked elements stay put. Membership is read once, before anything moves.

import {
  containerContents,
  deriveContainers,
  isContainer,
  type BoxedElement,
  type Element,
  type ElementId,
} from '@livediagram/document';
import { boxOf, shifted, type Box } from './placement';
import { currentElements, moveElement, putElement, touch, type EditState } from './state';

export type Axis = { horizontal: boolean; sign: 1 | -1 };

type Holders = ReadonlyMap<ElementId, ElementId | null>;

// What one make room reads: the elements and their holders before it, and what it has done so far.
type Pass = {
  state: EditState;
  before: readonly Element[];
  holders: Holders;
  // b's connected group, built when the shift reaches the top level.
  group: () => ReadonlySet<ElementId>;
  axis: Axis;
  shift: number;
  operation: number;
  moved: Set<ElementId>;
  grown: Set<ElementId>;
};

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

// The topmost container holding an element, or the element itself.
function topOf(holders: Holders, id: ElementId): ElementId {
  const holder = holders.get(id);
  return holder ? topOf(holders, holder) : id;
}

// The far edge of a box on the axis, and a box's centre on it.
const farEdgeOf = (box: Box, { horizontal, sign }: Axis) =>
  horizontal ? (sign > 0 ? box.x + box.width : box.x) : sign > 0 ? box.y + box.height : box.y;
const alongOf = (box: Box, { horizontal }: Axis) =>
  horizontal ? box.x + box.width / 2 : box.y + box.height / 2;

// One scope: shift its units past `midline`, then grow it and make room beyond it, outward.
function shiftScope(
  pass: Pass,
  scope: ElementId | null,
  midline: number,
  exclude: ReadonlySet<ElementId>,
): void {
  const { state, before, holders, group, axis, shift, operation, moved } = pass;
  const units = scope
    ? [...holders].filter(([, holder]) => holder === scope).map(([id]) => id)
    : [...new Set([...group()].map((id) => topOf(holders, id)))];
  const beyond = units.filter((id) => {
    if (exclude.has(id)) return false;
    const along = alongOf(boxOf(state.byId.get(id)!)!, axis);
    return axis.sign > 0 ? along > midline : along < midline;
  });
  const [dx, dy] = axis.horizontal ? [shift * axis.sign, 0] : [0, shift * axis.sign];
  for (const id of containerContents(before, new Set(beyond), holders)) {
    if (state.locked.has(id) || moved.has(id)) continue;
    moveElement(state, shifted(state.byId.get(id)!, dx, dy), operation, 'make room', {
      shift: [dx, dy],
    });
    moved.add(id);
  }
  if (scope === null) return;
  const holder = state.byId.get(scope)!;
  const farEdge = farEdgeOf(boxOf(holder)!, axis);
  // A mind node holds its children but has no room to grow; a locked container stays as it is.
  if (holder.type !== 'arrow' && isContainer(holder) && !state.locked.has(scope))
    grow(pass, holder);
  shiftScope(pass, holders.get(scope) ?? null, farEdge, new Set([...exclude, scope]));
}

// A container grown on its far side by the shift, reported as widened or taller.
function grow({ state, axis, shift, operation, grown }: Pass, container: BoxedElement): void {
  const next = axis.horizontal
    ? {
        ...container,
        width: container.width + shift,
        x: axis.sign > 0 ? container.x : container.x - shift,
      }
    : {
        ...container,
        height: container.height + shift,
        y: axis.sign > 0 ? container.y : container.y - shift,
      };
  putElement(state, next, operation);
  const touched = touch(state, container.id, operation);
  touched.fit = axis.horizontal
    ? { ...touched.fit, widened: [touched.fit?.widened?.[0] ?? container.width, next.width] }
    : { ...touched.fit, taller: [touched.fit?.taller?.[0] ?? container.height, next.height] };
  grown.add(container.id);
}

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
  const pass: Pass = {
    state,
    before,
    holders: deriveContainers(before),
    group: () => component(before, b),
    axis,
    shift,
    operation,
    moved: new Set(),
    grown: new Set(),
  };
  const near = farEdgeOf(node, { horizontal: axis.horizontal, sign: axis.sign > 0 ? -1 : 1 });
  shiftScope(pass, pass.holders.get(b) ?? null, near - (axis.sign * gap) / 2, new Set());
  state.log('[edit-ops] make-room', {
    operation,
    shifted: pass.moved.size,
    axis: axis.horizontal ? 'x' : 'y',
    grown: pass.grown.size,
  });
}
