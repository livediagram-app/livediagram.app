// `order <selector> front|back|above=<x>|below=<x>` (docs/specs/024-agents/blueprints/edit-operations.md
// "Operations", EO37): the target moves in the element order, last, first, directly after x or
// directly before x. Finalise then keeps every container behind its members.

import type { EditRejection } from '@livediagram/api-schema';
import type { ElementId } from '@livediagram/document';
import { resolveOne } from '../selectors';
import { refsOf, refuseLocked, reorder, touch, type EditState } from '../state';
import type { OrderOperation } from '../types';

type Place = { end: 'front' | 'back' } | { side: 'above' | 'below'; of: ElementId };

// Where the operation puts the target, the other element resolved.
function placeOf(
  state: EditState,
  operation: OrderOperation,
  target: ElementId,
  index: number,
): Place | { rejection: EditRejection } {
  if ('to' in operation) return { end: operation.to };
  const [side, selector] =
    'above' in operation
      ? (['above', operation.above] as const)
      : (['below', operation.below] as const);
  const other = resolveOne(state, selector, index);
  if ('rejection' in other) return other;
  if (other.el.id !== target) return { side, of: other.el.id };
  return {
    rejection: {
      code: 'invalid_value',
      operation: index,
      details: [`${side}=${selector}: an element is not ordered against itself`],
      hint: 'name another element',
    },
  };
}

export function applyOrder(
  state: EditState,
  operation: OrderOperation,
  index: number,
): EditRejection | null {
  const resolved = resolveOne(state, operation.target, index);
  if ('rejection' in resolved) return resolved.rejection;
  const { el } = resolved;
  const lock = state.locked.get(el.id);
  if (lock) return refuseLocked(state, 'order', index, el, lock);
  const place = placeOf(state, operation, el.id, index);
  if ('rejection' in place) return place.rejection;
  const order = state.order.filter((id) => id !== el.id);
  const at =
    'end' in place
      ? place.end === 'front'
        ? order.length
        : 0
      : order.indexOf(place.of) + (place.side === 'above' ? 1 : 0);
  order.splice(at, 0, el.id);
  reorder(state, order);
  touch(state, el.id, index).ordered =
    'end' in place ? place.end : `${place.side} ${refsOf(state).refOf(place.of)}`;
  return null;
}
