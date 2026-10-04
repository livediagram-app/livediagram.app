// `move <selector> <placement> | by=dx,dy [all]` (docs/specs/024-agents/blueprints/edit-operations.md
// "Placement", "Carry"): the targets' bounding box is placed as one box, or shifted by exactly
// `by`, and every element in the moving set (the targets and what a moved frame or lane carries)
// translates by the same delta. Pinned arrows follow by construction; finalise re-anchors them.

import type { EditRejection } from '@livediagram/api-schema';
import {
  containerContents,
  type Element,
  type ElementId,
  type Endpoint,
} from '@livediagram/document';
import { boxOf, resolvePlacement } from '../placement';
import { resolveSome } from '../selectors';
import { currentElements, moveElement, refuseLocked, type EditState, writeFields } from '../state';
import type { MoveOperation } from '../types';

const shiftEnd = (end: Endpoint, dx: number, dy: number): Endpoint =>
  end.kind === 'free' ? { ...end, x: end.x + dx, y: end.y + dy } : end;

// The element shifted by the delta: a box moves; an arrow moves its free ends.
export function shifted(el: Element, dx: number, dy: number): Element {
  if (el.type === 'arrow')
    return { ...el, from: shiftEnd(el.from, dx, dy), to: shiftEnd(el.to, dx, dy) };
  return { ...el, x: el.x + dx, y: el.y + dy };
}

// The bounding box of boxed elements, or null when none is boxed.
export function boundsOf(
  els: readonly Element[],
): { x: number; y: number; width: number; height: number } | null {
  const boxes = els.flatMap((el) => {
    const box = boxOf(el);
    return box ? [box] : [];
  });
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
}

export function applyMove(
  state: EditState,
  operation: MoveOperation,
  index: number,
): EditRejection | null {
  const resolved = resolveSome(state, operation.target, index, operation.all === true);
  if ('rejection' in resolved) return resolved.rejection;
  const targets = resolved.els;
  const named = new Set<ElementId>(targets.map((el) => el.id));
  const moving = containerContents(currentElements(state), named);
  for (const id of moving) {
    const el = state.byId.get(id)!;
    const lock = state.locked.get(id);
    if (lock) return refuseLocked(state, 'move', index, el, lock);
  }
  let dx: number;
  let dy: number;
  if ('by' in operation) [dx, dy] = operation.by;
  else {
    const bounds = boundsOf(targets);
    if (!bounds)
      return {
        code: 'invalid_value',
        operation: index,
        details: [
          `${operation.target}: arrows move with their ends; use by=dx,dy for a free arrow`,
        ],
        hint: 'move the boxes an arrow joins, or give by=dx,dy',
      };
    const size = { width: bounds.width, height: bounds.height };
    const placed = resolvePlacement(state, operation.place, size, moving, index, bounds);
    if ('rejection' in placed) return placed.rejection;
    [dx, dy] = [placed.x - bounds.x, placed.y - bounds.y];
  }
  if (dx === 0 && dy === 0) return null;
  for (const id of moving) {
    const el = shifted(state.byId.get(id)!, dx, dy);
    if (named.has(id))
      writeFields(state, el, index, el.type === 'arrow' ? ['from', 'to'] : ['x', 'y']);
    else moveElement(state, el, index, 'carried', [dx, dy]);
  }
  return null;
}
