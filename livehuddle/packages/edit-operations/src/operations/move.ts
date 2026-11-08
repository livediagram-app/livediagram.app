// `move <selector> <placement> | by=dx,dy [all]` (docs/specs/024-agents/blueprints/edit-operations.md
// "Placement"): the targets' bounding box is placed as one box, or shifted by exactly `by`, and every
// target translates by the same delta. Pinned arrows follow by construction; finalise re-anchors them.

import type { EditRejection } from '@livehuddle/api-schema';
import type { Element, ElementId } from '@livehuddle/document';
import { boxOf, resolvePlacement, shifted } from '../placement';
import { resolveSome } from '../selectors';
import { type EditState, writeFields } from '../state';
import type { MoveOperation } from '../types';

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
  const moving = new Set<ElementId>(targets.map((el) => el.id));
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
    writeFields(state, el, index, el.type === 'arrow' ? ['from', 'to'] : ['x', 'y']);
  }
  return null;
}
