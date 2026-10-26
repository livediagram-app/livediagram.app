// `set <selector> key=value… [all]` (docs/specs/024-agents/blueprints/edit-operations.md "Operations"):
// each target gets the fields in order, as stored fields; no geometry changes but named geometry. A target the
// fields leave as it was is not touched, so it is never normalised (E1, I2).

import type { EditRejection } from '@liveplanner/api-schema';
import type { Element } from '@liveplanner/project';
import { sameValue } from '../equality';
import { writeFieldsOnto } from '../fields';
import { resolveSome } from '../selectors';
import { type EditState, refuseLocked, writeFields } from '../state';
import type { SetOperation } from '../types';

export function applySet(
  state: EditState,
  { target, fields, all }: SetOperation,
  operation: number,
): EditRejection | null {
  const resolved = resolveSome(state, target, operation, all === true);
  if ('rejection' in resolved) return resolved.rejection;
  for (const el of resolved.els) {
    const rejection = setOne(state, el, fields, operation);
    if (rejection) return rejection;
  }
  return null;
}

function setOne(
  state: EditState,
  el: Element,
  fields: SetOperation['fields'],
  operation: number,
): EditRejection | null {
  const lock = state.locked.get(el.id);
  if (lock) return refuseLocked(state, 'set', operation, el, lock);
  const written = writeFieldsOnto(el, fields, operation);
  if ('code' in written) return written;
  if (sameValue(written.next, el)) return null;
  // No field moves an element between layers (plan-elements.ts), so an element on a locked layer was already
  // refused by its lock above.
  writeFields(state, written.next, operation, written.written);
  return null;
}
