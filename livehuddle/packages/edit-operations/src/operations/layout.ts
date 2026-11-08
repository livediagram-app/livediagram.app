// `layout <selector>` (docs/specs/024-agents/blueprints/edit-operations.md "Operations", EO38): the selected boxes are
// swept into rows from the selection's top-left, every box keeping its size. No arrow joins anything since part 4 of
// the element engine (docs/specs/002-project-scope/not-in-livehuddle.md), so the layered layout went with them and the
// sweep is the whole layout. Nothing outside the selection moves.

import type { EditRejection } from '@livehuddle/api-schema';
import { isBoxed, sweepEdgelessNodes, type BoxedElement } from '@livehuddle/document';
import { shifted } from '../placement';
import { resolveMembers } from '../selectors';
import { moveElement, type EditState } from '../state';
import type { LayoutOperation } from '../types';

// The selection's boxes swept into rows at its top-left, in the given order.
export function laidOut(boxes: readonly BoxedElement[]): BoxedElement[] {
  const originX = Math.min(...boxes.map((el) => el.x));
  const originY = Math.min(...boxes.map((el) => el.y));
  // The sweep starts at 0,0: the rows belong at the selection's top-left.
  return sweepEdgelessNodes([...boxes]).map((el) => shifted(el, originX, originY) as BoxedElement);
}

export function applyLayout(
  state: EditState,
  { target }: LayoutOperation,
  operation: number,
): EditRejection | null {
  const resolved = resolveMembers(state, [target], operation);
  if ('rejection' in resolved) return resolved.rejection;
  const boxes = resolved.els.filter(isBoxed);
  if (boxes.length === 0) return null;
  for (const el of laidOut(boxes)) moveElement(state, el, operation, 'laid out');
  state.log('[edit-ops] laid-out', { operation, boxes: boxes.length });
  return null;
}
