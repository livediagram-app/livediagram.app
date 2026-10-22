// `rm <selector> [all]` (docs/specs/024-agents/blueprints/edit-operations.md "Operations"): each target leaves the
// tab. A Dashboard slot that showed one says so where it was, as when a person deletes it.

import type { EditRejection } from '@liveplanner/api-schema';
import { resolveSome } from '../selectors';
import { type EditState, refuseLocked, removeElement } from '../state';
import type { RmOperation } from '../types';

export function applyRm(
  state: EditState,
  { target, all }: RmOperation,
  operation: number,
): EditRejection | null {
  const resolved = resolveSome(state, target, operation, all === true);
  if ('rejection' in resolved) return resolved.rejection;
  for (const el of resolved.els) {
    const lock = state.locked.get(el.id);
    if (lock) return refuseLocked(state, 'rm', operation, el, lock);
  }
  for (const { id } of resolved.els) removeElement(state, id, operation);
  return null;
}
