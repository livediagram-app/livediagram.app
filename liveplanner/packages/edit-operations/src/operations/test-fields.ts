// `test <selector> key=value…` (docs/specs/024-agents/blueprints/edit-operations.md "Operations", EO39): each field
// compares the value `set` would write with the stored one: strings exactly, `key=` holding when the field is absent,
// objects by value. Any difference refuses the changeset; it changes nothing.

import type { EditRejection, JsonValue } from '@liveplanner/api-schema';
import { sameValue } from '../equality';
import { fieldValue, writeFieldsOnto } from '../fields';
import { formatValue } from '../format-results';
import { testFailed } from '../rejections';
import { resolveOne } from '../selectors';
import { refsOf, type EditState } from '../state';
import type { TestOperation } from '../types';

const shown = (key: string, v: unknown): string => {
  if (v === undefined || v === null) return '(none)';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    return formatValue(key, v);
  return JSON.stringify(v);
};

export function applyTest(
  state: EditState,
  { target, fields }: TestOperation,
  operation: number,
): EditRejection | null {
  const resolved = resolveOne(state, target, operation);
  if ('rejection' in resolved) return resolved.rejection;
  const { el } = resolved;
  const ref = refsOf(state).refOf(el.id);
  const failures: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    const written = writeFieldsOnto(el, { [key]: value }, operation);
    if ('code' in written) return written;
    if (sameValue(el, written.next)) continue;
    failures.push(
      `${ref} ${key}: expected ${shown(key, value satisfies JsonValue)}, actual ${shown(key, fieldValue(el, key))}`,
    );
  }
  if (failures.length === 0) return null;
  state.log('[edit-ops] test-failed', { operation, fields: failures.length });
  return testFailed(operation, failures, ref);
}
