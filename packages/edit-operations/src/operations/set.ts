// `set <selector> key=value… [all]` with stored field names
// (docs/specs/024-agents/blueprints/edit-operations.md "Fields and values"): `null` unsets a field,
// the rest merge as the MCP's update merges. Identity, live fields and prototype keys are refused.

import type { EditRejection } from '@livediagram/api-schema';
import {
  ELEMENT_FIELD_NAMES,
  LIVE_ELEMENT_FIELDS,
  isElementFieldName,
  mergeElementUpdate,
  type Element,
} from '@livediagram/document';
import { kindOf } from '../element-text';
import { layerLockOf } from '../locks';
import { invalidValue, unknownField } from '../rejections';
import { type EditState, refuseLocked, resolveTarget, writeFields } from '../state';
import type { FieldValue, SetOperation } from '../types';
import { PROTOTYPE_KEYS } from '../vocabulary';

const LIVE_FIELDS: ReadonlySet<string> = new Set(LIVE_ELEMENT_FIELDS);
const IDENTITY_FIELDS: ReadonlySet<string> = new Set(['id', 'type']);
// A stroke's former point fields, which normalising packs (docs/specs/006-document/stroke-points.md).
const FORMER_FIELDS: Readonly<Partial<Record<Element['type'], readonly string[]>>> = {
  freehand: ['points', 'pressures'],
};
const LIVE_HINT = "comments go through the comment commands; responses and ideas are people's";

const isWritable = (type: Element['type'], key: string) =>
  isElementFieldName(type, key) || (FORMER_FIELDS[type]?.includes(key) ?? false);

// The refusal one field earns on this element, or null when it may be written.
function fieldRejection(
  el: Element,
  key: string,
  value: FieldValue,
  operation: number,
): EditRejection | null {
  const fields = ELEMENT_FIELD_NAMES[el.type];
  if (PROTOTYPE_KEYS.has(key)) return unknownField(operation, kindOf(el), key, fields);
  if (IDENTITY_FIELDS.has(key)) return invalidValue(operation, key, value, 'cannot be changed');
  if (LIVE_FIELDS.has(key))
    return invalidValue(operation, key, value, 'people change it, not edit operations', LIVE_HINT);
  return isWritable(el.type, key) ? null : unknownField(operation, kindOf(el), key, fields);
}

export function applySet(
  state: EditState,
  { target, fields }: SetOperation,
  operation: number,
): EditRejection | null {
  const resolved = resolveTarget(state, target, operation);
  if ('rejection' in resolved) return resolved.rejection;
  const { el } = resolved;
  const lock = state.locked.get(el.id);
  if (lock) return refuseLocked(state, 'set', operation, el, lock);
  const patch: Record<string, FieldValue> = {};
  const unset: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    const rejection = fieldRejection(el, key, value, operation);
    if (rejection) return rejection;
    if (value === null) unset.push(key);
    else patch[key] = value;
  }
  const merged = mergeElementUpdate(el, patch);
  for (const key of unset) delete merged[key];
  const next = merged as Element;
  const layerLock = layerLockOf(state.tab.layers, next.layerId);
  if (layerLock) return refuseLocked(state, 'set', operation, next, layerLock);
  writeFields(state, next, operation, Object.keys(fields));
  return null;
}
