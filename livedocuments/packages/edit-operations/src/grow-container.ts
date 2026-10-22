// A frame or stack grown to hold a box placed in it (docs/specs/024-agents/blueprints/edit-operations.md "Growing to
// hold"): it takes its new box, and on each side it grew, what lay past its old edge within its span moves on by the
// growth, carrying what it holds, so the grown container never takes in what sat beside it. Only the container's own
// scope moves; what sits inside it stays where it was put. A container nested in another grows that one in turn,
// when it or what it moved on now reaches past it.

import {
  containerContents,
  isContainer,
  type BoxedElement,
  type ElementId,
} from '@livedocuments/document';
import { boxOf, shifted, type Box } from './placement';
import {
  currentElements,
  holdersOf,
  moveElement,
  putElement,
  touch,
  type EditState,
} from './state';

// How far inside a container's old edge a neighbour may start and still count as lying past it: a box drawn flush
// against the frame.
const PAST_EDGE_TOLERANCE = 2;

/** Room a frame or stack leaves around what it holds. */
export const HOLD_PAD = 32;

type Side = { dx: number; dy: number; past: (box: Box) => boolean };

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

export function growContainer(
  state: EditState,
  container: BoxedElement,
  next: Box,
  // The box the container grows to hold: it is placed already, never moved on.
  held: ElementId,
  operation: number,
  // What an inner container's growth already moved on, never moved again by this one's.
  settled: ReadonlySet<ElementId> = new Set(),
): void {
  const holders = holdersOf(state);
  const scope = holders.get(container.id) ?? null;
  const old = { left: container.x, top: container.y, right: container.x + container.width };
  const oldBottom = container.y + container.height;
  const right = next.x + next.width;
  const bottom = next.y + next.height;
  const inRows = (b: Box) => overlaps(b.y, b.y + b.height, next.y, bottom);
  const inColumns = (b: Box) => overlaps(b.x, b.x + b.width, next.x, right);
  const sides: Side[] = [
    {
      dx: right - old.right,
      dy: 0,
      past: (b) => b.x >= old.right - PAST_EDGE_TOLERANCE && inRows(b),
    },
    {
      dx: 0,
      dy: bottom - oldBottom,
      past: (b) => b.y >= oldBottom - PAST_EDGE_TOLERANCE && inColumns(b),
    },
    {
      dx: next.x - old.left,
      dy: 0,
      past: (b) => b.x + b.width <= old.left + PAST_EDGE_TOLERANCE && inRows(b),
    },
    {
      dx: 0,
      dy: next.y - old.top,
      past: (b) => b.y + b.height <= old.top + PAST_EDGE_TOLERANCE && inColumns(b),
    },
  ];
  const before = currentElements(state);
  // The container's neighbours: the units of its own scope, read before anything moves.
  const neighbours = before.flatMap((el) => {
    const box = boxOf(el);
    return box &&
      el.id !== container.id &&
      el.id !== held &&
      !settled.has(el.id) &&
      (holders.get(el.id) ?? null) === scope
      ? [{ id: el.id, box }]
      : [];
  });
  const moved = new Set<ElementId>();
  for (const { dx, dy, past } of sides) {
    if (dx === 0 && dy === 0) continue;
    const units = neighbours
      .filter((n) => !moved.has(n.id) && !state.locked.has(n.id) && past(n.box))
      .map((n) => n.id);
    if (units.length === 0) continue;
    const carried = containerContents(before, new Set(units), holders);
    // A unit moved on one side is no unit on the next, and what it holds moves only with it: nothing moves twice.
    for (const id of carried) {
      if (state.locked.has(id)) continue;
      moveElement(state, shifted(state.byId.get(id)!, dx, dy), operation, 'make room', {
        shift: [dx, dy],
      });
      moved.add(id);
    }
  }
  putElement(state, { ...container, ...next }, operation);
  const touched = touch(state, container.id, operation);
  touched.fit = {
    ...touched.fit,
    ...(next.width !== container.width
      ? { widened: [container.width, next.width] as [number, number] }
      : {}),
    ...(next.height !== container.height
      ? { taller: [container.height, next.height] as [number, number] }
      : {}),
  };
  state.log('[edit-ops] grow-container', { operation, shifted: moved.size });
  growScope(state, scope, [container.id, ...moved], operation, settled);
}

// The container holding a grown one, grown in turn to hold it and what it moved on with HOLD_PAD, when either now
// reaches past it. A locked one stays as it is.
function growScope(
  state: EditState,
  scope: ElementId | null,
  ids: readonly ElementId[],
  operation: number,
  settled: ReadonlySet<ElementId>,
): void {
  const parent = scope ? state.byId.get(scope) : undefined;
  if (!parent || parent.type === 'arrow' || !isContainer(parent) || state.locked.has(parent.id))
    return;
  let [x, y] = [parent.x, parent.y];
  let [right, bottom] = [parent.x + parent.width, parent.y + parent.height];
  // A carried arrow has no box: only boxes count.
  const boxes = ids.map((id) => boxOf(state.byId.get(id)!)).filter((b): b is Box => b !== null);
  for (const box of boxes) {
    x = Math.min(x, box.x - HOLD_PAD);
    y = Math.min(y, box.y - HOLD_PAD);
    right = Math.max(right, box.x + box.width + HOLD_PAD);
    bottom = Math.max(bottom, box.y + box.height + HOLD_PAD);
  }
  if (
    x === parent.x &&
    y === parent.y &&
    right === parent.x + parent.width &&
    bottom === parent.y + parent.height
  )
    return;
  const next = { x, y, width: Math.round(right - x), height: Math.round(bottom - y) };
  growContainer(state, parent, next, ids[0]!, operation, new Set([...settled, ...ids]));
}
