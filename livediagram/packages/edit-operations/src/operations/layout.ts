// `layout <selector> [style=flow|tree|mindmap] [direction=down|right]`
// (docs/specs/024-agents/blueprints/edit-operations.md "Operations", EO38): the selected boxes and the
// arrows between them are laid out from the selection's top-left, every box keeping its size; boxes
// no arrow joins are swept into rows below (from the top-left when none is joined). Nothing outside
// the selection moves.

import type { EditRejection } from '@livediagram/api-schema';
import {
  autoLayoutElements,
  flowDirectionOf,
  sweepEdgelessNodes,
  type BoxedElement,
  type Element,
  type ElementId,
} from '@livediagram/document';
import { shifted } from '../placement';
import { resolveMembers } from '../selectors';
import {
  currentElements,
  moveElement,
  putElement,
  refuseLocked,
  type EditState,
  type LaidOut,
} from '../state';
import type { LayoutOperation } from '../types';

const DIRECTIONS = { down: 'TB', right: 'LR' } as const;

// The selection's boxes laid out, the arrows between them re-anchored, in the given order.
export function laidOut(
  boxes: readonly BoxedElement[],
  arrows: readonly Element[],
  style: LaidOut['style'],
  direction: 'TB' | 'LR' | undefined,
): Element[] {
  const originX = Math.min(...boxes.map((el) => el.x));
  const originY = Math.min(...boxes.map((el) => el.y));
  const subset = [...boxes, ...arrows];
  const placed = autoLayoutElements(subset, {
    style,
    ...(direction ? { direction } : {}),
    originX,
    originY,
    fixedSizeIds: new Set(boxes.map((el) => el.id)),
  });
  const swept = sweepEdgelessNodes(placed);
  // With no arrow among them the sweep starts at 0,0: it belongs at the selection's top-left.
  return arrows.length > 0 ? swept : swept.map((el) => shifted(el, originX, originY));
}

// Lays out `boxes` and the arrows between them in place, reporting each box as laid out. The
// caller has refused locked boxes; locked arrows keep their ends.
export function layOut(
  state: EditState,
  boxes: readonly BoxedElement[],
  style: LaidOut['style'],
  direction: 'down' | 'right' | undefined,
  operation: number,
): void {
  const ids = new Set<ElementId>(boxes.map((el) => el.id));
  const arrows = currentElements(state).filter(
    (el) =>
      el.type === 'arrow' &&
      !state.locked.has(el.id) &&
      el.from.kind === 'pinned' &&
      el.to.kind === 'pinned' &&
      ids.has(el.from.elementId) &&
      ids.has(el.to.elementId),
  );
  const flow = direction ? DIRECTIONS[direction] : flowDirectionOf([...boxes, ...arrows]);
  const how: LaidOut =
    style === 'flow' ? { style, direction: flow === 'TB' ? 'down' : 'right' } : { style };
  for (const el of laidOut(boxes, arrows, style, style === 'flow' ? flow : undefined)) {
    if (el.type === 'arrow') putElement(state, el, operation);
    else moveElement(state, el, operation, 'laid out', { layout: how });
  }
  state.log('[edit-ops] laid-out', {
    operation,
    boxes: boxes.length,
    arrows: arrows.length,
    style,
  });
}

// The first locked box, refused.
export function lockedAmong(
  state: EditState,
  boxes: readonly BoxedElement[],
  op: 'layout' | 'wrap',
  operation: number,
): EditRejection | null {
  for (const el of boxes) {
    const lock = state.locked.get(el.id);
    if (lock) return refuseLocked(state, op, operation, el, lock);
  }
  return null;
}

export function applyLayout(
  state: EditState,
  { target, style = 'flow', direction }: LayoutOperation,
  operation: number,
): EditRejection | null {
  const resolved = resolveMembers(state, [target], operation);
  if ('rejection' in resolved) return resolved.rejection;
  const boxes = resolved.els.filter((el): el is BoxedElement => el.type !== 'arrow');
  const locked = lockedAmong(state, boxes, 'layout', operation);
  if (locked) return locked;
  if (boxes.length > 0) layOut(state, boxes, style, direction, operation);
  return null;
}
