// `test <selector> key=value…` (docs/specs/024-agents/blueprints/edit-operations.md "Operations", EO39):
// each field compares the value `set` would write with the stored one, aliases resolved, without the
// label cap or a coercion warning: strings exactly, `key=` holding when the field is absent, colours
// by slot or the hex case-insensitively. Any difference refuses the changeset; it changes nothing.

import type { EditRejection, JsonValue } from '@livediagram/api-schema';
import type { Element } from '@livediagram/document';
import { isHexColour } from '../colours';
import { sameValue } from '../equality';
import { fieldValue, writeFieldsOnto } from '../fields';
import { formatValue } from '../format-results';
import { testFailed } from '../rejections';
import { resolveOne } from '../selectors';
import { refsOf, type EditState } from '../state';
import type { FieldValue, TestOperation } from '../types';

// Hex colours compare without case; everything else by value.
function sameIgnoringHexCase(a: unknown, b: unknown): boolean {
  const fold = (v: unknown): unknown => {
    if (isHexColour(v)) return String(v).toLowerCase();
    if (Array.isArray(v)) return v.map(fold);
    if (typeof v !== 'object' || v === null) return v;
    return Object.fromEntries(Object.entries(v).map(([key, inner]) => [key, fold(inner)]));
  };
  return sameValue(fold(a), fold(b));
}

const shown = (key: string, v: unknown): string => {
  if (v === undefined || v === null) return '(none)';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    return formatValue(key, v);
  return JSON.stringify(v);
};

// Whether `el` already holds `key=value`, or why not.
function holds(el: Element, key: string, value: FieldValue, next: Element): boolean {
  if (key !== 'label') return sameIgnoringHexCase(el, next);
  const label = Reflect.get(el, 'label');
  return value === null ? label === undefined || label === '' : label === value;
}

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
    const written = writeFieldsOnto(el, { [key]: value }, state.theme, ref, operation);
    if ('code' in written) return written;
    if (holds(el, key, value, written.next)) continue;
    const actual: unknown = fieldValue(el, key, state.theme);
    failures.push(
      `${ref} ${key}: expected ${shown(key, value satisfies JsonValue)}, actual ${shown(key, actual)}`,
    );
  }
  if (failures.length === 0) return null;
  state.log('[edit-ops] test-failed', { operation, fields: failures.length });
  return testFailed(operation, failures, ref);
}
