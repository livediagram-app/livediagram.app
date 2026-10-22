// Fields onto an element (docs/specs/024-agents/blueprints/edit-operations.md "Fields and values"): the stored fields
// a Plan element takes by name (./plan-elements), as `view=show` prints them. `null` unsets. Identity, live fields
// and prototype keys are refused, and so is a field the element does not take, listing the ones it does.

import type { EditRejection } from '@liveplanner/api-schema';
import {
  ELEMENT_FIELD_VALUES,
  LIVE_ELEMENT_FIELDS,
  fieldValueIssue,
  mergeElementUpdate,
  type Element,
} from '@liveplanner/project';
import { kindOf } from './element-text';
import { planFieldsOf } from './plan-elements';
import { invalidValue, unknownField } from './rejections';
import type { FieldValue, Fields } from './types';
import { PROTOTYPE_KEYS } from './vocabulary';

const LIVE_FIELDS: ReadonlySet<string> = new Set(LIVE_ELEMENT_FIELDS);
// `addedBy` is the server's record of which Participant added an element (docs/specs/013-workspace/share-roles.md).
const IDENTITY_FIELDS: ReadonlySet<string> = new Set(['id', 'type', 'shape', 'addedBy']);
const LIVE_HINT = "comments go through the comment commands; responses are people's";

// What an element holds under a field name.
export function fieldValue(el: Element, key: string): unknown {
  return Reflect.get(el, key);
}

export type FieldsWrite<T extends Element = Element> = {
  next: T;
  // The keys written: the order a ~ line prints them in.
  written: string[];
};

type Patch = Record<string, FieldValue | undefined>;

// Writes `fields` onto `el`.
export function writeFieldsOnto<T extends Element>(
  el: T,
  fields: Fields,
  operation: number,
): FieldsWrite<T> | EditRejection {
  const takes = planFieldsOf(el);
  const patch: Patch = {};
  for (const [key, value] of Object.entries(fields)) {
    if (PROTOTYPE_KEYS.has(key)) return unknownField(operation, kindOf(el), key, takes);
    if (IDENTITY_FIELDS.has(key)) return invalidValue(operation, key, value, 'cannot be changed');
    if (LIVE_FIELDS.has(key))
      return invalidValue(
        operation,
        key,
        value,
        'people change it, not edit operations',
        LIVE_HINT,
      );
    if (!takes.includes(key)) return unknownField(operation, kindOf(el), key, takes);
    // A closed vocabulary's value off its list is refused with the list (element-field-values.ts).
    if (fieldValueIssue(key, value))
      return invalidValue(
        operation,
        key,
        value,
        'is not a value it takes',
        `${key} takes ${ELEMENT_FIELD_VALUES[key]!.join(', ')}.`,
      );
    if (key === 'label' && value !== null && typeof value !== 'string')
      return invalidValue(operation, key, value, 'text, in quotes when it has spaces');
    patch[key] = value;
  }
  const set = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== null && v !== undefined),
  );
  const merged = mergeElementUpdate(el, set);
  for (const [key, v] of Object.entries(patch))
    if (v === null || v === undefined) delete merged[key];
  // Every key was checked against the element's fields above, so the element keeps its type; finalise
  // validates the values.
  return { next: merged as T, written: Object.keys(fields) };
}
