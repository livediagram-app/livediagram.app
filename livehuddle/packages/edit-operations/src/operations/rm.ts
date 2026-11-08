// `rm <selector> [all]` (docs/specs/024-agents/blueprints/edit-operations.md "Operations"): removes what the
// selector names, and only that. A stored arrow is a retired element (docs/specs/002-project-scope/
// not-in-livehuddle.md "The element engine", part 4): removing what it is pinned to leaves it as stored (D23).

import type { EditRejection } from '@livehuddle/api-schema';
import { resolveSome } from '../selectors';
import { type EditState, removeElement } from '../state';
import type { RmOperation } from '../types';

export function applyRm(
  state: EditState,
  { target, all }: RmOperation,
  operation: number,
): EditRejection | null {
  const resolved = resolveSome(state, target, operation, all === true);
  if ('rejection' in resolved) return resolved.rejection;
  for (const { id } of resolved.els) removeElement(state, id, operation);
  return null;
}
