// `unwrap <container>` (docs/specs/024-agents/blueprints/edit-operations.md "Operations", EO36): the boundary or
// lane goes; what it held stays where it is; arrows pinned to it go with it, as `rm` removes them.

import type { EditRejection } from '@livehuddle/api-schema';
import { isContainer } from '@livehuddle/document';
import { resolveOne } from '../selectors';
import { refsOf, type EditState } from '../state';
import type { UnwrapOperation } from '../types';
import { removeOne } from './rm';

export function applyUnwrap(
  state: EditState,
  { target }: UnwrapOperation,
  operation: number,
): EditRejection | null {
  const resolved = resolveOne(state, target, operation);
  if ('rejection' in resolved) return resolved.rejection;
  const { el } = resolved;
  if (!isContainer(el))
    return {
      code: 'invalid_value',
      operation,
      details: [`${target}: ${refsOf(state).refOf(el.id)} is not a boundary or a lane`],
      hint: 'unwrap a boundary or lane; rm removes anything else',
    };
  removeOne(state, el, false, operation, { unwrapped: true });
  return null;
}
